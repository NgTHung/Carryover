import { strict as assert } from 'node:assert';

import { createCategoryData } from '../src/data/categories';
import { createCommitmentData } from '../src/data/commitments';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createMonthConfigData } from '../src/data/month-config';
import { createPeriodPreparationData } from '../src/data/period-preparation';
import { createManualTransactionData } from '../src/data/manual-transactions';
import { createTransactionData } from '../src/data/transactions';
import type { AtomicTransactionRunner, LedgerDatabase } from '../src/data/atomic';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const now = new Date(2026, 8, 15, 12, 30, 0, 250);
const today = new Date(2026, 8, 15, 9, 0);
const yesterday = new Date(2026, 8, 14, 18, 0);
const tomorrow = new Date(2026, 8, 16, 9, 0);

type IdRow = { id: string };

function idFor(database: ReturnType<typeof openMigratedDatabase>, query: string, ...params: string[]): string {
  const row = database.prepare(query).get(...params) as IdRow | undefined;
  if (row === undefined) throw new Error(`Missing id for ${query}`);
  return row.id;
}

function bankId(database: ReturnType<typeof openMigratedDatabase>): string {
  return idFor(database, "SELECT id FROM accounts WHERE name = 'Bank'");
}

function cashId(database: ReturnType<typeof openMigratedDatabase>): string {
  return idFor(database, "SELECT id FROM accounts WHERE name = 'Cash'");
}

function leafId(database: ReturnType<typeof openMigratedDatabase>): string {
  return idFor(database, "SELECT id FROM categories WHERE name = 'Groceries'");
}

function groupId(database: ReturnType<typeof openMigratedDatabase>): string {
  return idFor(database, "SELECT id FROM categories WHERE name = 'Food' AND parent_id IS NULL");
}

function count(database: ReturnType<typeof openMigratedDatabase>, table: string): number {
  return (database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;
}

function incomeForCurrentPeriod(database: ReturnType<typeof openMigratedDatabase>): number {
  return (database.prepare("SELECT income_total AS incomeTotal FROM month_config WHERE period = '2026-09'").get() as { incomeTotal: number }).incomeTotal;
}

function createManualData(
  database: ReturnType<typeof openMigratedDatabase>,
  changes: string[] = []
) {
  const proxy = createProxyDatabase(database);
  const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
  notifier.subscribe(({ table, mutation }) => changes.push(`${table}:${mutation}`));
  return createManualTransactionData(
    proxy,
    createCategoryData(proxy),
    notifier,
    { now: () => now }
  );
}

test('period preparation captures pre-period money and current known income exactly', async () => {
  const database = openMigratedDatabase();
  try {
    database.prepare("UPDATE accounts SET opening_balance = 1000 WHERE name = 'Bank'").run();
    const proxy = createProxyDatabase(database);
    const categories = createCategoryData(proxy);
    const genericTransactions = createTransactionData(proxy, categories);
    const commitmentData = createCommitmentData(proxy);
    const bank = bankId(database);
    const groceries = leafId(database);

    await genericTransactions.createTransaction({
      accountId: bank,
      direction: 'expense',
      status: 'complete',
      amount: 1500,
      categoryId: groceries,
      occurredAt: new Date(2026, 7, 31, 10),
    });
    await genericTransactions.createTransaction({
      accountId: bank,
      direction: 'income',
      status: 'complete',
      amount: 700,
      occurredAt: today,
    });
    await genericTransactions.createTransaction({
      accountId: bank,
      direction: 'income',
      status: 'draft',
      amount: '  ',
      occurredAt: new Date(2026, 5, 10, 10),
    });
    await commitmentData.createCommitment({
      name: 'Rent',
      amount: 300,
      dueDay: 20,
      categoryId: idFor(database, "SELECT id FROM categories WHERE name = 'Rent' AND parent_id IS NOT NULL"),
    });

    const preparation = createPeriodPreparationData(proxy, { now: () => now });
    const config = await preparation.prepareCurrentPeriod();
    assert.deepEqual(config, {
      period: '2026-09',
      openingBalance: -500,
      incomeTotal: 700,
      reservedTotal: 300,
      horizonDate: '2026-09-30',
    });
    assert.equal((database.prepare("SELECT COUNT(*) AS count FROM month_config WHERE period = '2026-06'").get() as { count: number }).count, 0);
    assert.equal(count(database, 'month_config'), 1);

    const repeated = await Promise.all([
      preparation.prepareCurrentPeriod(),
      preparation.prepareCurrentPeriod(),
    ]);
    assert.deepEqual(repeated, [config, config]);

    const rollover = createPeriodPreparationData(proxy, {
      now: () => new Date(2026, 11, 15, 12),
    });
    const december = await rollover.prepareCurrentPeriod();
    assert.deepEqual(december, {
      period: '2026-12',
      openingBalance: 200,
      incomeTotal: 0,
      reservedTotal: 300,
      horizonDate: '2026-12-31',
    });
    assert.deepEqual(await preparation.prepareCurrentPeriod(), config);
    assert.equal(count(database, 'month_config'), 2);
  } finally {
    database.close();
  }
});

test('manual create updates current income once and leaves frozen historical money totals alone', async () => {
  const database = openMigratedDatabase();
  try {
    const historical = createManualData(database);
    await historical.createTransaction({
      accountId: bankId(database),
      direction: 'income',
      status: 'complete',
      amount: 900,
      occurredAt: new Date(2025, 0, 10, 10),
    });
    const proxy = createProxyDatabase(database);
    const monthConfigs = createMonthConfigData(proxy);
    const past = await monthConfigs.openPeriod({
      period: '2025-01',
      openingBalance: 10_000,
      incomeTotal: 2_000,
      reservedTotal: 300,
      horizonDate: '2025-02-15',
    });
    const changes: string[] = [];
    const data = createManualData(database, changes);
    const created = await data.createTransaction({
      accountId: bankId(database),
      direction: 'income',
      status: 'complete',
      amount: '1250000',
      occurredAt: now,
      note: '  salary  ',
      sourceLabel: '  payroll  ',
    });

    assert.equal(created.amount, 1_250_000);
    assert.equal(created.note, 'salary');
    assert.equal(created.sourceLabel, 'payroll');
    assert.deepEqual(created.payer, { kind: 'you' });
    assert.equal(created.photoKey, null);
    assert.equal(created.categoryId, null);
    assert.equal(created.adjustmentEffect, null);
    assert.equal(incomeForCurrentPeriod(database), 1_250_000);
    assert.deepEqual(await monthConfigs.readMonthConfig(past.period), past);
    assert.deepEqual(changes, ['month_config:edited', 'transactions:created']);

    const second = await data.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'complete',
      amount: 500,
      categoryId: leafId(database),
      occurredAt: yesterday,
    });
    assert.equal(second.amount, 500);
    assert.equal(incomeForCurrentPeriod(database), 1_250_000);
    assert.deepEqual(changes, [
      'month_config:edited',
      'transactions:created',
      'transactions:created',
    ]);
  } finally {
    database.close();
  }
});

test('manual create rejects future dates and invalid active references without rows or notifications', async () => {
  const database = openMigratedDatabase();
  try {
    const changes: string[] = [];
    const data = createManualData(database, changes);
    const bank = bankId(database);
    const unknown = '44444444-4444-4444-8444-444444444444';

    await assert.rejects(
      data.createTransaction({
        accountId: bank,
        direction: 'income',
        status: 'complete',
        amount: 100,
        occurredAt: tomorrow,
      }),
      /future/i
    );
    await assert.rejects(
      data.createTransaction({
        accountId: unknown,
        direction: 'income',
        status: 'complete',
        amount: 100,
        occurredAt: today,
      }),
      /active account/i
    );
    await assert.rejects(
      data.createTransaction({
        accountId: bank,
        direction: 'expense',
        status: 'complete',
        amount: 100,
        categoryId: groupId(database),
        occurredAt: today,
      }),
      /category leaf/i
    );
    assert.equal(count(database, 'transactions'), 0);
    assert.equal(count(database, 'month_config'), 0);
    assert.deepEqual(changes, []);
  } finally {
    database.close();
  }
});

test('manual edits and completion maintain current income across direction, date, delete, and validation changes', async () => {
  const database = openMigratedDatabase();
  try {
    const changes: string[] = [];
    const data = createManualData(database, changes);
    const bank = bankId(database);
    const income = await data.createTransaction({
      accountId: bank,
      direction: 'income',
      status: 'complete',
      amount: 1_000,
      occurredAt: today,
      sourceLabel: 'Salary',
    });
    assert.equal(incomeForCurrentPeriod(database), 1_000);

    const expense = await data.editTransaction({
      transactionId: income.id,
      changes: { direction: 'expense', categoryId: leafId(database) },
    });
    assert.equal(expense.direction, 'expense');
    assert.equal(expense.categoryId, leafId(database));
    assert.equal(expense.sourceLabel, null);
    assert.equal(incomeForCurrentPeriod(database), 0);

    const restored = await data.editTransaction({
      transactionId: income.id,
      changes: { direction: 'income', sourceLabel: '  corrected  ', categoryId: groupId(database) },
    });
    assert.equal(restored.categoryId, null);
    assert.equal(restored.sourceLabel, 'corrected');
    assert.equal(incomeForCurrentPeriod(database), 1_000);

    await assert.rejects(
      data.editTransaction({
        transactionId: income.id,
        changes: { occurredAt: tomorrow },
      }),
      /future/i
    );
    assert.equal(incomeForCurrentPeriod(database), 1_000);

    await data.editTransaction({
      transactionId: income.id,
      changes: { occurredAt: new Date(2026, 7, 1, 10) },
    });
    assert.equal(incomeForCurrentPeriod(database), 0);
    await data.editTransaction({
      transactionId: income.id,
      changes: { occurredAt: today },
    });
    assert.equal(incomeForCurrentPeriod(database), 1_000);

    await data.softDeleteTransaction(income.id);
    assert.equal(incomeForCurrentPeriod(database), 0);

    const generic = createTransactionData(createProxyDatabase(database), createCategoryData(createProxyDatabase(database)));
    const draft = await generic.createTransaction({
      accountId: bank,
      direction: 'income',
      status: 'draft',
      amount: 200,
      occurredAt: today,
    });
    const completed = await data.completeDraft({
      transactionId: draft.id,
      amount: 300,
    });
    assert.equal(completed.status, 'complete');
    assert.equal(incomeForCurrentPeriod(database), 300);

    const expenseDraft = await generic.createTransaction({
      accountId: bank,
      direction: 'expense',
      status: 'draft',
      occurredAt: today,
    });
    await assert.rejects(
      data.completeDraft({ transactionId: expenseDraft.id, amount: 100 }),
      /category/i
    );
    assert.equal((await generic.readTransaction(expenseDraft.id))?.status, 'draft');
    assert.equal(incomeForCurrentPeriod(database), 300);
    assert.ok(changes.length > 0);
  } finally {
    database.close();
  }
});

test('completion and edit reject deleted or unknown references while preserving unchanged historical references', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createManualData(database);
    const bank = bankId(database);
    const cash = cashId(database);
    const groceries = leafId(database);
    const transaction = await data.createTransaction({
      accountId: bank,
      direction: 'expense',
      status: 'complete',
      amount: 100,
      categoryId: groceries,
      occurredAt: today,
    });

    database.prepare('UPDATE accounts SET deleted_at = ? WHERE id = ?').run(now.getTime(), cash);
    database.prepare('UPDATE categories SET deleted_at = ? WHERE id = ?').run(now.getTime(), groceries);
    await assert.rejects(
      data.editTransaction({ transactionId: transaction.id, changes: { accountId: cash } }),
      /active account/i
    );
    await assert.rejects(
      data.editTransaction({ transactionId: transaction.id, changes: { categoryId: cash } }),
      /category leaf/i
    );
    const preserved = await data.editTransaction({
      transactionId: transaction.id,
      changes: { note: 'kept history' },
    });
    assert.equal(preserved.accountId, bank);
    assert.equal(preserved.categoryId, groceries);
    assert.equal(preserved.note, 'kept history');

    const proxy = createProxyDatabase(database);
    const generic = createTransactionData(proxy, createCategoryData(proxy));
    const draft = await generic.createTransaction({
      accountId: bank,
      direction: 'expense',
      status: 'draft',
      occurredAt: today,
    });
    database.prepare('UPDATE accounts SET deleted_at = ? WHERE id = ?').run(now.getTime(), bank);
    await assert.rejects(
      data.completeDraft({ transactionId: draft.id, amount: 100, categoryId: groceries }),
      /active account|category leaf/i
    );
    assert.equal((await generic.readTransaction(draft.id))?.status, 'draft');
  } finally {
    database.close();
  }
});

test('a failure after mutation rolls back the transaction and current income together', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
    const changes: string[] = [];
    notifier.subscribe(({ table, mutation }) => changes.push(`${table}:${mutation}`));
    const runAtomic: AtomicTransactionRunner<'async'> = async <T>(
      operation: (transactionDb: LedgerDatabase<'async'>) => Promise<T>
    ) =>
      proxy.transaction(async (transactionDb) => {
        await operation(transactionDb);
        throw new Error('simulated commit failure');
      });
    const data = createManualTransactionData(
      proxy,
      createCategoryData(proxy),
      notifier,
      { now: () => now, runAtomic }
    );

    await assert.rejects(
      data.createTransaction({
        accountId: bankId(database),
        direction: 'income',
        status: 'complete',
        amount: 750,
        occurredAt: today,
      }),
      /simulated commit failure/i
    );
    assert.equal(count(database, 'transactions'), 0);
    assert.equal(count(database, 'month_config'), 0);
    assert.deepEqual(changes, []);
  } finally {
    database.close();
  }
});
