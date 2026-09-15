import { strict as assert } from 'node:assert';

import type { BudgetSnapshot } from '../src/budget/snapshot';
import {
  createSnapshotPublisher,
  startSnapshotPublisher,
} from '../src/budget/snapshot-publisher';
import { readBudgetInput } from '../src/budget/snapshot-source';
import { createSnapshotStore } from '../src/budget/snapshot-store';
import { createAccountData } from '../src/data/accounts';
import { createCategoryData } from '../src/data/categories';
import { createCommitmentData } from '../src/data/commitments';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createManualTransactionData } from '../src/data/manual-transactions';
import { createMonthConfigData } from '../src/data/month-config';
import { createPeriodPreparationData } from '../src/data/period-preparation';
import { createShareData } from '../src/data/shares';
import { createTransactionData } from '../src/data/transactions';
import { createTransactionListData } from '../src/data/transaction-list';
import { openMigratedDatabase, createProxyDatabase } from './support/sqlite-proxy';

const september = new Date(2026, 8, 15, 12);
const groceriesId = '20000000-0000-4000-8000-000000000001';

type AccountRow = {
  id: string;
  name: string;
  kind: string;
  is_default: number;
  opening_balance: number;
  updated_at: number;
};

type Harness = ReturnType<typeof createHarness>;

function accountId(
  database: ReturnType<typeof openMigratedDatabase>,
  name: string
): string {
  const row = database
    .prepare('SELECT id FROM accounts WHERE name = ? AND deleted_at IS NULL')
    .get(name) as { id: string } | undefined;
  if (row === undefined) throw new Error(`Missing active account ${name}`);
  return row.id;
}

function accountRow(
  database: ReturnType<typeof openMigratedDatabase>,
  id: string
): AccountRow {
  return database
    .prepare(
      'SELECT id, name, kind, is_default, opening_balance, updated_at FROM accounts WHERE id = ?'
    )
    .get(id) as AccountRow;
}

function monthConfigRow(
  database: ReturnType<typeof openMigratedDatabase>,
  period: string
): Record<string, unknown> | undefined {
  return database
    .prepare(
      `SELECT period, opening_balance, income_total, reserved_total,
              horizon_date, created_at, updated_at
       FROM month_config WHERE period = ? AND deleted_at IS NULL`
    )
    .get(period) as Record<string, unknown> | undefined;
}

function reportTotals(
  database: ReturnType<typeof openMigratedDatabase>
): { spending: number; income: number; adjustments: number } {
  return database
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN direction = 'expense' THEN amount ELSE 0 END), 0) AS spending,
         COALESCE(SUM(CASE WHEN direction = 'income' THEN amount ELSE 0 END), 0) AS income,
         COALESCE(SUM(CASE WHEN direction = 'adjustment' THEN amount ELSE 0 END), 0) AS adjustments
       FROM transactions WHERE deleted_at IS NULL`
    )
    .get() as { spending: number; income: number; adjustments: number };
}

function transactionCount(
  database: ReturnType<typeof openMigratedDatabase>
): number {
  return (
    database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as {
      count: number;
    }
  ).count;
}

function readySnapshot(publisher: Harness['publisher']): BudgetSnapshot {
  const state = publisher.store.getState();
  if (state.status !== 'ready') {
    throw new Error(`Expected ready snapshot, received ${state.status}`);
  }
  return state.snapshot;
}

function snapshotMatches(
  publisher: Harness['publisher'],
  predicate: (snapshot: BudgetSnapshot) => boolean
): boolean {
  const state = publisher.store.getState();
  return state.status === 'ready' && predicate(state.snapshot);
}

function financialSnapshot(snapshot: BudgetSnapshot): Omit<BudgetSnapshot, 'updatedAt'> {
  const { updatedAt: _updatedAt, ...financial } = snapshot;
  return financial;
}

async function waitFor(
  condition: () => boolean,
  message: string
): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (condition()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error(message);
}

function createHarness(
  database: ReturnType<typeof openMigratedDatabase>,
  clock: () => Date
) {
  const proxy = createProxyDatabase(database);
  const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
  const silentNotifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
  const preparation = createPeriodPreparationData(proxy, {
    now: clock,
    changeNotifier: silentNotifier,
  });
  const accountData = createAccountData(proxy, notifier, { now: clock });
  const reads = {
    accounts: createAccountData(proxy, silentNotifier),
    commitments: createCommitmentData(proxy, silentNotifier),
    monthConfig: createMonthConfigData(proxy, silentNotifier),
    shares: createShareData(proxy),
    transactions: createTransactionData(
      proxy,
      createCategoryData(proxy, silentNotifier),
      silentNotifier
    ),
  };
  const transactionList = createTransactionListData(proxy, silentNotifier);
  const written: BudgetSnapshot[] = [];
  let failWrite = false;
  const publisher = createSnapshotPublisher({
    store: createSnapshotStore(),
    now: clock,
    readInput: async (at) => {
      await preparation.prepareCurrentPeriod(at);
      return readBudgetInput(reads, at);
    },
    writer(snapshot) {
      if (failWrite) throw new Error('shared storage unavailable');
      written.push(snapshot);
    },
  });
  return {
    accountData,
    monthConfigs: reads.monthConfig,
    preparation,
    publisher,
    notifier,
    transactionList,
    written,
    setWriteFailure(value: boolean) {
      failWrite = value;
    },
  };
}

async function startHarness(harness: Harness): Promise<() => void> {
  const stop = startSnapshotPublisher(harness.publisher, harness.notifier);
  await waitFor(
    () => harness.written.length > 0 && harness.publisher.store.getState().status === 'ready',
    'Initial snapshot did not publish'
  );
  return stop;
}

async function addExpense(
  database: ReturnType<typeof openMigratedDatabase>,
  harness: Harness,
  occurredAt: Date,
  amount: number
): Promise<void> {
  const proxy = createProxyDatabase(database);
  const manual = createManualTransactionData(
    proxy,
    createCategoryData(proxy),
    harness.notifier,
    { now: () => occurredAt }
  );
  await manual.createTransaction({
    accountId: accountId(database, 'Bank'),
    direction: 'expense',
    status: 'complete',
    amount,
    categoryId: groceriesId,
    occurredAt,
  });
}

test('rename refreshes account and transaction labels without changing financial fields', async () => {
  const database = openMigratedDatabase();
  try {
    database
      .prepare("UPDATE accounts SET opening_balance = 300000 WHERE name = 'Bank'")
      .run();
    const harness = createHarness(database, () => september);
    await harness.preparation.prepareCurrentPeriod(september);
    await addExpense(database, harness, september, 200_000);
    const stop = await startHarness(harness);
    const beforeSnapshot = readySnapshot(harness.publisher);
    const bankId = accountId(database, 'Bank');
    const beforeAccount = accountRow(database, bankId);
    const beforeConfig = monthConfigRow(database, '2026-09');

    await harness.accountData.editAccountDetails({
      accountId: bankId,
      name: 'Main bank',
      openingBalance: 300_000,
    });
    await waitFor(
      () => snapshotMatches(
        harness.publisher,
        (snapshot) => snapshot.balanceTotal === beforeSnapshot.balanceTotal
      ),
      'Rename publication did not settle'
    );

    const afterAccount = accountRow(database, bankId);
    assert.equal(afterAccount.id, beforeAccount.id);
    assert.equal(afterAccount.name, 'Main bank');
    assert.equal(afterAccount.kind, beforeAccount.kind);
    assert.equal(afterAccount.is_default, beforeAccount.is_default);
    assert.equal(afterAccount.opening_balance, beforeAccount.opening_balance);
    assert.deepEqual(monthConfigRow(database, '2026-09'), beforeConfig);
    assert.deepEqual(
      financialSnapshot(readySnapshot(harness.publisher)),
      financialSnapshot(beforeSnapshot)
    );

    const rows = await harness.transactionList.readTransactionList({
      period: '2026-09',
      categoryId: null,
      accountId: null,
      quality: null,
    });
    const expense = rows.find((row) => row.kind === 'transaction');
    if (expense === undefined || expense.kind !== 'transaction') {
      throw new Error('Expected the expense row');
    }
    assert.deepEqual(expense.account, {
      id: bankId,
      name: 'Main bank',
      kind: 'bank',
    });
    assert.equal(harness.written[harness.written.length - 1], readySnapshot(harness.publisher));
    stop();
  } finally {
    database.close();
  }
});

test('opening balance edits change the live projection, then reconcile remains visible and report-neutral', async () => {
  const database = openMigratedDatabase();
  try {
    database
      .prepare("UPDATE accounts SET opening_balance = 1000000 WHERE name = 'Bank'")
      .run();
    const harness = createHarness(database, () => september);
    const past = await harness.monthConfigs.openPeriod({
      period: '2026-08',
      openingBalance: 700_000,
      incomeTotal: 400_000,
      reservedTotal: 200_000,
      horizonDate: '2026-08-25',
    });
    await harness.preparation.prepareCurrentPeriod(september);
    await addExpense(database, harness, september, 200_000);
    const currentBefore = monthConfigRow(database, '2026-09');
    const pastBefore = monthConfigRow(database, past.period);
    const reportBefore = reportTotals(database);
    const stop = await startHarness(harness);
    const bankId = accountId(database, 'Bank');
    assert.equal(readySnapshot(harness.publisher).balanceTotal, 800_000);

    await harness.accountData.editAccountDetails({
      accountId: bankId,
      name: 'Bank',
      openingBalance: 1_200_000,
    });
    await waitFor(
      () => snapshotMatches(
        harness.publisher,
        (snapshot) => snapshot.balanceTotal === 1_000_000
      ),
      'Opening balance publication did not settle'
    );
    assert.equal(transactionCount(database), 1);
    assert.deepEqual(monthConfigRow(database, '2026-09'), currentBefore);
    assert.deepEqual(monthConfigRow(database, past.period), pastBefore);
    assert.deepEqual(reportTotals(database), reportBefore);
    assert.equal(readySnapshot(harness.publisher).spentThisMonth, 200_000);

    const reconciled = await harness.accountData.reconcileAccount({
      accountId: bankId,
      statedBalance: 950_000,
      occurredAt: september,
    });
    assert.equal(reconciled.status, 'adjusted');
    if (reconciled.status !== 'adjusted') throw new Error('Expected adjustment');
    assert.equal(reconciled.adjustmentAmount, 50_000);
    assert.equal(reconciled.adjustmentEffect, 'decrease');
    await waitFor(
      () => snapshotMatches(
        harness.publisher,
        (snapshot) => snapshot.balanceTotal === 950_000
      ),
      'Reconcile publication did not settle'
    );
    assert.equal(transactionCount(database), 2);
    const reportAfterReconcile = reportTotals(database);
    assert.equal(reportAfterReconcile.spending, reportBefore.spending);
    assert.equal(reportAfterReconcile.income, reportBefore.income);
    assert.equal(reportAfterReconcile.adjustments, 50_000);
    assert.equal((await harness.accountData.reconcileAccount({
      accountId: bankId,
      statedBalance: 950_000,
      occurredAt: september,
    })).status, 'unchanged');
    assert.equal(transactionCount(database), 2);
    assert.deepEqual(monthConfigRow(database, '2026-09'), currentBefore);
    assert.deepEqual(monthConfigRow(database, past.period), pastBefore);
    stop();
  } finally {
    database.close();
  }
});

test('first period preparation captures the pre-edit baseline and later edits do not replace it', async () => {
  const database = openMigratedDatabase();
  try {
    database
      .prepare("UPDATE accounts SET opening_balance = 300000 WHERE name = 'Bank'")
      .run();
    const harness = createHarness(database, () => september);
    const bankId = accountId(database, 'Bank');

    await harness.accountData.editAccountDetails({
      accountId: bankId,
      name: 'Main bank',
      openingBalance: 450_000,
    });
    assert.equal(monthConfigRow(database, '2026-09')?.opening_balance, 300_000);
    const stop = await startHarness(harness);
    assert.equal(readySnapshot(harness.publisher).balanceTotal, 450_000);
    assert.equal(readySnapshot(harness.publisher).perDay, 30_000);

    await harness.accountData.editAccountDetails({
      accountId: bankId,
      name: 'Main bank',
      openingBalance: 500_000,
    });
    await waitFor(
      () => snapshotMatches(
        harness.publisher,
        (snapshot) => snapshot.balanceTotal === 500_000
      ),
      'Second opening edit did not publish'
    );
    assert.equal(monthConfigRow(database, '2026-09')?.opening_balance, 300_000);
    stop();
  } finally {
    database.close();
  }
});

test('rollover preparation is tied to submission time and leaves older configs frozen', async () => {
  const database = openMigratedDatabase();
  try {
    database
      .prepare("UPDATE accounts SET opening_balance = 300000 WHERE name = 'Bank'")
      .run();
    let at = new Date(2026, 9, 15, 12);
    const harness = createHarness(database, () => at);
    const bankId = accountId(database, 'Bank');
    const septemberConfig = await harness.monthConfigs.openPeriod({
      period: '2026-09',
      openingBalance: 250_000,
      incomeTotal: 10_000,
      reservedTotal: 20_000,
      horizonDate: '2026-09-28',
    });

    await harness.accountData.editAccountDetails({
      accountId: bankId,
      name: 'October bank',
      openingBalance: 450_000,
    });
    assert.deepEqual(await harness.monthConfigs.readMonthConfig('2026-09'), septemberConfig);
    assert.equal(monthConfigRow(database, '2026-10')?.opening_balance, 300_000);

    at = new Date(2027, 0, 15, 12);
    await harness.accountData.editAccountDetails({
      accountId: bankId,
      name: 'January bank',
      openingBalance: 500_000,
    });
    assert.deepEqual(await harness.monthConfigs.readMonthConfig('2026-09'), septemberConfig);
    assert.equal(monthConfigRow(database, '2026-10')?.opening_balance, 300_000);
    assert.equal(monthConfigRow(database, '2027-01')?.opening_balance, 450_000);
  } finally {
    database.close();
  }
});

test('publication failure does not repeat the committed account edit or adjustment', async () => {
  const database = openMigratedDatabase();
  try {
    database
      .prepare("UPDATE accounts SET opening_balance = 300000 WHERE name = 'Bank'")
      .run();
    const harness = createHarness(database, () => september);
    await harness.preparation.prepareCurrentPeriod(september);
    const stop = await startHarness(harness);
    const bankId = accountId(database, 'Bank');
    harness.setWriteFailure(true);

    await harness.accountData.editAccountDetails({
      accountId: bankId,
      name: 'Unshared bank',
      openingBalance: 450_000,
    });
    await waitFor(
      () => harness.publisher.store.getState().status === 'error',
      'Publisher did not expose the storage failure'
    );
    assert.equal(accountRow(database, bankId).name, 'Unshared bank');
    assert.equal(accountRow(database, bankId).opening_balance, 450_000);
    assert.equal(transactionCount(database), 0);

    harness.setWriteFailure(false);
    await harness.publisher.retry();
    assert.equal(harness.publisher.store.getState().status, 'ready');
    assert.equal(readySnapshot(harness.publisher).balanceTotal, 450_000);
    assert.equal(transactionCount(database), 0);
    assert.equal(harness.written[harness.written.length - 1], readySnapshot(harness.publisher));
    stop();
  } finally {
    database.close();
  }
});
