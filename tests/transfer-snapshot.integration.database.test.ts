import { strict as assert } from 'node:assert';

import { readBudgetInput } from '../src/budget/snapshot-source';
import type { BudgetSnapshot } from '../src/budget/snapshot';
import {
  createSnapshotPublisher,
  startSnapshotPublisher,
} from '../src/budget/snapshot-publisher';
import { createSnapshotStore } from '../src/budget/snapshot-store';
import { createAccountData } from '../src/data/accounts';
import { createCategoryData } from '../src/data/categories';
import { createCommitmentData } from '../src/data/commitments';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createMonthConfigData } from '../src/data/month-config';
import { createMonthSummaryData } from '../src/data/month-summary';
import { createPeriodPreparationData } from '../src/data/period-preparation';
import { createShareData } from '../src/data/shares';
import { createTransactionData } from '../src/data/transactions';
import { createTransactionListData } from '../src/data/transaction-list';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const september = new Date(2026, 8, 15, 12);
const bankOpeningBalance = 1_000_000;
const cashOpeningBalance = 250_000;
const expenseId = '11111111-1111-4111-8111-111111111111';
const incomeId = '11111111-1111-4111-8111-111111111112';
const unknownDraftId = '11111111-1111-4111-8111-111111111113';
const contactId = '22222222-2222-4222-8222-222222222222';
const ownShareId = '33333333-3333-4333-8333-333333333331';
const contactShareId = '33333333-3333-4333-8333-333333333332';

type Clock = () => Date;

async function waitFor(condition: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (condition()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error(message);
}

function idFor(
  database: ReturnType<typeof openMigratedDatabase>,
  query: string
): string {
  const row = database.prepare(query).get() as { id: string } | undefined;
  if (row === undefined) throw new Error(`Missing id for ${query}`);
  return row.id;
}

function readySnapshot(
  publisher: ReturnType<typeof createSnapshotPublisher>
): BudgetSnapshot {
  const state = publisher.store.getState();
  if (state.status !== 'ready') {
    throw new Error(`Expected ready snapshot, received ${state.status}`);
  }
  return state.snapshot;
}

function financialSnapshot(snapshot: BudgetSnapshot): Omit<BudgetSnapshot, 'updatedAt'> {
  const { updatedAt: _updatedAt, ...financial } = snapshot;
  return financial;
}

function createHarness(
  database: ReturnType<typeof openMigratedDatabase>,
  clock: Clock
) {
  const proxy = createProxyDatabase(database);
  const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
  const silentNotifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
  const preparation = createPeriodPreparationData(proxy, {
    now: clock,
    changeNotifier: silentNotifier,
  });
  const monthConfigs = createMonthConfigData(proxy, silentNotifier);
  const accountData = createAccountData(proxy, notifier, { now: clock });
  const reads = {
    accounts: createAccountData(proxy, silentNotifier),
    commitments: createCommitmentData(proxy, silentNotifier),
    monthConfig: monthConfigs,
    shares: createShareData(proxy),
    transactions: createTransactionData(
      proxy,
      createCategoryData(proxy, silentNotifier),
      silentNotifier
    ),
  };
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
    notifier,
    monthConfigs,
    preparation,
    publisher,
    summaryData: createMonthSummaryData(proxy),
    transactionList: createTransactionListData(proxy, silentNotifier),
    written,
    setWriteFailure(value: boolean) {
      failWrite = value;
    },
  };
}

function insertReportFixture(
  database: ReturnType<typeof openMigratedDatabase>,
  bankId: string,
  groceriesId: string
): void {
  const expenseAt = new Date(2026, 8, 10, 10).getTime();
  const incomeAt = new Date(2026, 8, 11, 10).getTime();
  database.prepare('INSERT INTO contacts (id, name) VALUES (?, ?)').run(contactId, 'Alex');
  database
    .prepare(
      `INSERT INTO transactions
        (id, account_id, direction, amount, category_id, quality, occurred_at, status)
       VALUES (?, ?, 'expense', ?, ?, 'need', ?, 'complete')`
    )
    .run(expenseId, bankId, 100_000, groceriesId, expenseAt);
  database
    .prepare(
      `INSERT INTO splits (id, transaction_id, contact_id, share_amount)
       VALUES (?, ?, ?, ?)`
    )
    .run(ownShareId, expenseId, null, 60_000);
  database
    .prepare(
      `INSERT INTO splits (id, transaction_id, contact_id, share_amount)
       VALUES (?, ?, ?, ?)`
    )
    .run(contactShareId, expenseId, contactId, 40_000);
  database
    .prepare(
      `INSERT INTO transactions
        (id, account_id, direction, amount, occurred_at, status)
       VALUES (?, ?, 'income', ?, ?, 'complete')`
    )
    .run(incomeId, bankId, 50_000, incomeAt);
  database
    .prepare(
      `INSERT INTO transactions
        (id, account_id, direction, amount, occurred_at, status)
       VALUES (?, ?, 'expense', NULL, ?, 'draft')`
    )
    .run(unknownDraftId, bankId, expenseAt);
}

async function openPreparedCurrentPeriod(
  harness: ReturnType<typeof createHarness>,
  horizonDate = '2026-09-30'
): Promise<void> {
  await harness.monthConfigs.openPeriod({
    period: '2026-09',
    openingBalance: 1_250_000,
    incomeTotal: 50_000,
    reservedTotal: 100_000,
    horizonDate,
  });
}

test('a transfer publishes once, preserves reports, and appears under both account filters', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = idFor(database, "SELECT id FROM accounts WHERE name = 'Bank'");
    const cashId = idFor(database, "SELECT id FROM accounts WHERE name = 'Cash'");
    const groceriesId = idFor(
      database,
      "SELECT id FROM categories WHERE name = 'Groceries' AND deleted_at IS NULL"
    );
    database
      .prepare('UPDATE accounts SET opening_balance = ? WHERE id = ?')
      .run(bankOpeningBalance, bankId);
    database
      .prepare('UPDATE accounts SET opening_balance = ? WHERE id = ?')
      .run(cashOpeningBalance, cashId);
    insertReportFixture(database, bankId, groceriesId);

    const harness = createHarness(database, () => september);
    await openPreparedCurrentPeriod(harness);
    await harness.monthConfigs.openPeriod({
      period: '2026-08',
      openingBalance: 900_000,
      incomeTotal: 25_000,
      reservedTotal: 80_000,
      horizonDate: '2026-08-31',
    });
    const currentConfigBefore = await harness.monthConfigs.readMonthConfig('2026-09');
    const pastConfigBefore = await harness.monthConfigs.readMonthConfig('2026-08');
    const reportBefore = await harness.summaryData.readMonthSummary('2026-09', '2026-09-15');
    assert.ok(currentConfigBefore);
    assert.ok(pastConfigBefore);
    assert.ok(reportBefore);

    const stop = startSnapshotPublisher(harness.publisher, {
      subscribe: (listener) => harness.notifier.subscribe(listener),
    });
    await waitFor(
      () => harness.written.length === 1 && harness.publisher.store.getState().status === 'ready',
      'Initial snapshot did not publish'
    );
    const beforeSnapshot = readySnapshot(harness.publisher);

    await harness.accountData.recordTransfer({
      fromAccountId: bankId,
      toAccountId: cashId,
      amount: 200_000,
      occurredAt: september,
    });
    await waitFor(() => harness.written.length === 2, 'Transfer did not trigger snapshot publication');

    const balances = await harness.accountData.readAccountBalances();
    assert.equal(balances.find(({ accountId }) => accountId === bankId)?.balance, 750_000);
    assert.equal(balances.find(({ accountId }) => accountId === cashId)?.balance, 450_000);
    assert.equal(
      balances.reduce((total, account) => total + account.balance, 0),
      1_200_000
    );
    assert.equal(
      (database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count,
      3
    );
    assert.equal(
      (database.prepare('SELECT COUNT(*) AS count FROM transfers').get() as { count: number }).count,
      1
    );

    const afterSnapshot = readySnapshot(harness.publisher);
    assert.deepEqual(financialSnapshot(afterSnapshot), financialSnapshot(beforeSnapshot));
    assert.equal(harness.written[harness.written.length - 1], afterSnapshot);
    assert.deepEqual(await harness.summaryData.readMonthSummary('2026-09', '2026-09-15'), reportBefore);
    assert.deepEqual(await harness.monthConfigs.readMonthConfig('2026-09'), currentConfigBefore);
    assert.deepEqual(await harness.monthConfigs.readMonthConfig('2026-08'), pastConfigBefore);

    const allRows = await harness.transactionList.readTransactionList({
      period: '2026-09',
      categoryId: null,
      accountId: null,
      quality: null,
    });
    const transferRow = allRows.find(
      (row) => row.kind === 'transfer' && row.source === 'transfers'
    );
    assert.ok(transferRow);
    if (transferRow === undefined || transferRow.kind !== 'transfer' || transferRow.source !== 'transfers') {
      throw new Error('Expected a dedicated transfer row');
    }
    assert.deepEqual(await harness.accountData.readTransfer(transferRow.transfer.id), {
      transfer: transferRow.transfer,
      fromAccount: transferRow.fromAccount,
      toAccount: transferRow.toAccount,
    });

    for (const accountId of [bankId, cashId]) {
      const filtered = await harness.transactionList.readTransactionList({
        period: '2026-09',
        categoryId: null,
        accountId,
        quality: null,
      });
      assert.equal(
        filtered.some(
          (row) => row.kind === 'transfer' && row.source === 'transfers' && row.transfer.id === transferRow.transfer.id
        ),
        true
      );
    }
    const categoryFiltered = await harness.transactionList.readTransactionList({
      period: '2026-09',
      categoryId: groceriesId,
      accountId: null,
      quality: null,
    });
    assert.equal(categoryFiltered.some((row) => row.kind === 'transfer' && row.source === 'transfers'), false);
    const qualityFiltered = await harness.transactionList.readTransactionList({
      period: '2026-09',
      categoryId: null,
      accountId: null,
      quality: 'need',
    });
    assert.equal(qualityFiltered.some((row) => row.kind === 'transfer' && row.source === 'transfers'), false);
    stop();
  } finally {
    database.close();
  }
});

test('a transfer after rollover opens only the current period and contributes no income', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = idFor(database, "SELECT id FROM accounts WHERE name = 'Bank'");
    const cashId = idFor(database, "SELECT id FROM accounts WHERE name = 'Cash'");
    database.prepare('UPDATE accounts SET opening_balance = ? WHERE id = ?').run(950_000, bankId);
    database.prepare('UPDATE accounts SET opening_balance = ? WHERE id = ?').run(250_000, cashId);
    let currentTime = new Date(2026, 8, 30, 12);
    const harness = createHarness(database, () => currentTime);
    await harness.monthConfigs.openPeriod({
      period: '2026-09',
      openingBalance: 1_250_000,
      incomeTotal: 0,
      reservedTotal: 100_000,
      horizonDate: '2026-10-15',
    });
    const septemberBefore = await harness.monthConfigs.readMonthConfig('2026-09');
    assert.ok(septemberBefore);
    const stop = startSnapshotPublisher(harness.publisher, {
      subscribe: (listener) => harness.notifier.subscribe(listener),
    });
    await waitFor(() => harness.written.length === 1, 'Initial rollover snapshot did not publish');

    currentTime = new Date(2026, 9, 1, 12);
    await harness.accountData.recordTransfer({
      fromAccountId: bankId,
      toAccountId: cashId,
      amount: 50_000,
      occurredAt: currentTime,
    });
    await waitFor(() => harness.written.length === 2, 'Rollover transfer did not publish');

    const october = await harness.monthConfigs.readMonthConfig('2026-10');
    assert.ok(october);
    assert.equal(october.incomeTotal, 0);
    assert.equal(october.openingBalance, 1_200_000);
    assert.deepEqual(await harness.monthConfigs.readMonthConfig('2026-09'), septemberBefore);
    stop();
  } finally {
    database.close();
  }
});

test('a publication failure leaves the transfer committed and retry publishes without reinsertion', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = idFor(database, "SELECT id FROM accounts WHERE name = 'Bank'");
    const cashId = idFor(database, "SELECT id FROM accounts WHERE name = 'Cash'");
    database.prepare('UPDATE accounts SET opening_balance = ? WHERE id = ?').run(950_000, bankId);
    database.prepare('UPDATE accounts SET opening_balance = ? WHERE id = ?').run(250_000, cashId);
    const harness = createHarness(database, () => september);
    await openPreparedCurrentPeriod(harness);
    const stop = startSnapshotPublisher(harness.publisher, {
      subscribe: (listener) => harness.notifier.subscribe(listener),
    });
    await waitFor(() => harness.written.length === 1, 'Initial failure test snapshot did not publish');

    harness.setWriteFailure(true);
    await harness.accountData.recordTransfer({
      fromAccountId: bankId,
      toAccountId: cashId,
      amount: 200_000,
      occurredAt: september,
    });
    await waitFor(
      () => harness.publisher.store.getState().status === 'error',
      'Publisher did not expose the storage failure'
    );
    assert.equal(
      (database.prepare('SELECT COUNT(*) AS count FROM transfers').get() as { count: number }).count,
      1
    );
    assert.equal(
      (await harness.accountData.readAccountBalances()).find(({ accountId }) => accountId === bankId)?.balance,
      750_000
    );

    harness.setWriteFailure(false);
    await harness.publisher.retry();
    assert.equal(harness.publisher.store.getState().status, 'ready');
    assert.equal(harness.written.length, 2);
    assert.equal(
      (database.prepare('SELECT COUNT(*) AS count FROM transfers').get() as { count: number }).count,
      1
    );
    stop();
  } finally {
    database.close();
  }
});
