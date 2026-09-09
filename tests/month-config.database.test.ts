import { strict as assert } from 'node:assert';

import { createCategoryData } from '../src/data/categories';
import { createCommitmentData } from '../src/data/commitments';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createMonthConfigData } from '../src/data/month-config';
import { createTransactionData } from '../src/data/transactions';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

type IdRow = { id: string };

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((complete) => {
    resolve = () => complete();
  });
  return { promise, resolve };
}

function bankId(database: ReturnType<typeof openMigratedDatabase>): string {
  const row = database
    .prepare("SELECT id FROM accounts WHERE name = 'Bank'")
    .get() as IdRow;
  return row.id;
}

function groceriesId(database: ReturnType<typeof openMigratedDatabase>): string {
  const row = database
    .prepare("SELECT id FROM categories WHERE name = 'Groceries'")
    .get() as IdRow;
  return row.id;
}

function rentReserveId(
  database: ReturnType<typeof openMigratedDatabase>
): string {
  const row = database
    .prepare("SELECT id FROM categories WHERE name = 'Rent' AND parent_id IS NOT NULL")
    .get() as IdRow;
  return row.id;
}

function monthConfigRow(
  database: ReturnType<typeof openMigratedDatabase>,
  period: string
): Record<string, unknown> | undefined {
  return database
    .prepare('SELECT * FROM month_config WHERE period = ?')
    .get(period) as Record<string, unknown> | undefined;
}

test('open and read preserve a snapshot, default the horizon, and notify only on insert', async () => {
  const database = openMigratedDatabase();
  try {
    const changes: string[] = [];
    const notifier = createLedgerChangeNotifier({
      onListenerError: () => undefined,
    });
    notifier.subscribe(({ table, mutation }) => changes.push(`${table}:${mutation}`));
    const data = createMonthConfigData(createProxyDatabase(database), notifier);

    const created = await data.openPeriod({
      period: '2026-02',
      openingBalance: 0,
      incomeTotal: 0,
      reservedTotal: 0,
    });
    assert.deepEqual(created, {
      period: '2026-02',
      openingBalance: 0,
      incomeTotal: 0,
      reservedTotal: 0,
      horizonDate: '2026-02-28',
    });
    assert.deepEqual(await data.readMonthConfig('2026-02'), created);
    assert.deepEqual(changes, ['month_config:created']);

    const firstRow = monthConfigRow(database, '2026-02');
    assert.ok(firstRow);
    const duplicate = await data.openPeriod({
      period: '2026-02',
      openingBalance: 999_000,
      incomeTotal: 888_000,
      reservedTotal: 777_000,
      horizonDate: '2026-03-31',
    });
    assert.deepEqual(duplicate, created);
    assert.deepEqual(changes, ['month_config:created']);
    assert.deepEqual(monthConfigRow(database, '2026-02'), firstRow);
  } finally {
    database.close();
  }
});

test('open accepts an explicit horizon beyond the period end', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createMonthConfigData(createProxyDatabase(database));
    const config = await data.openPeriod({
      period: '2024-02',
      openingBalance: 100,
      incomeTotal: 200,
      reservedTotal: 300,
      horizonDate: '2026-01-01',
    });
    assert.equal(config.horizonDate, '2026-01-01');
  } finally {
    database.close();
  }
});

test('horizon edits change only the horizon, preserve frozen totals, and notify actual writes', async () => {
  const database = openMigratedDatabase();
  try {
    const changes: string[] = [];
    const notifier = createLedgerChangeNotifier();
    notifier.subscribe(({ table, mutation }) => changes.push(`${table}:${mutation}`));
    const data = createMonthConfigData(createProxyDatabase(database), notifier);
    const original = await data.openPeriod({
      period: '2026-09',
      openingBalance: 1_000_000,
      incomeTotal: 2_000_000,
      reservedTotal: 300_000,
    });
    const originalRow = monthConfigRow(database, original.period);
    assert.ok(originalRow);

    const unchanged = await data.updateHorizon({
      period: original.period,
      horizonDate: original.horizonDate,
    });
    assert.deepEqual(unchanged, original);
    assert.deepEqual(changes, ['month_config:created']);
    assert.deepEqual(monthConfigRow(database, original.period), originalRow);

    const edited = await data.updateHorizon({
      period: original.period,
      horizonDate: '2026-10-15',
    });
    assert.deepEqual(edited, { ...original, horizonDate: '2026-10-15' });
    assert.deepEqual(changes, ['month_config:created', 'month_config:edited']);
    const editedRow = monthConfigRow(database, original.period);
    assert.ok(editedRow);
    assert.equal(editedRow.opening_balance, originalRow.opening_balance);
    assert.equal(editedRow.income_total, originalRow.income_total);
    assert.equal(editedRow.reserved_total, originalRow.reserved_total);
    assert.equal(editedRow.horizon_date, '2026-10-15');
    assert.notEqual(editedRow.updated_at, originalRow.updated_at);
  } finally {
    database.close();
  }
});

test('stale horizon edits report a concurrent change without overwriting or notifying', async () => {
  const database = openMigratedDatabase();
  try {
    const changes: string[] = [];
    const notifier = createLedgerChangeNotifier();
    notifier.subscribe(({ table, mutation }) => changes.push(`${table}:${mutation}`));
    const initialData = createMonthConfigData(createProxyDatabase(database), notifier);
    await initialData.openPeriod({
      period: '2026-09',
      openingBalance: 1_000_000,
      incomeTotal: 2_000_000,
      reservedTotal: 300_000,
    });
    changes.length = 0;

    const loserRead = deferred();
    const releaseLoser = deferred();
    let initialReadHeld = false;
    const loserDatabase = createProxyDatabase(database, {
      afterQuery: async (query, _params, method) => {
        if (
          method === 'get' &&
          !initialReadHeld &&
          query.includes('month_config')
        ) {
          initialReadHeld = true;
          loserRead.resolve();
          await releaseLoser.promise;
        }
      },
    });
    const loserData = createMonthConfigData(loserDatabase, notifier);
    const winnerData = createMonthConfigData(createProxyDatabase(database), notifier);

    const loserUpdate = loserData.updateHorizon({
      period: '2026-09',
      horizonDate: '2026-10-10',
    });
    await loserRead.promise;

    const winner = await winnerData.updateHorizon({
      period: '2026-09',
      horizonDate: '2026-10-20',
    });
    releaseLoser.resolve();

    await assert.rejects(
      loserUpdate,
      /month config.*2026-09.*changed during update/i
    );
    assert.equal(winner.horizonDate, '2026-10-20');
    assert.deepEqual(changes, ['month_config:edited']);
    assert.equal(
      (await winnerData.readMonthConfig('2026-09'))?.horizonDate,
      '2026-10-20'
    );
  } finally {
    database.close();
  }
});

test('horizon edits reject missing and soft-deleted periods, while reads hide deleted rows', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createMonthConfigData(createProxyDatabase(database));
    await assert.rejects(
      data.updateHorizon({ period: '2026-09', horizonDate: '2026-10-01' }),
      /active month config.*2026-09.*not found/i
    );
    await data.openPeriod({
      period: '2026-09',
      openingBalance: 1,
      incomeTotal: 2,
      reservedTotal: 3,
    });
    database
      .prepare("UPDATE month_config SET deleted_at = 1735689600000 WHERE period = '2026-09'")
      .run();
    assert.equal(await data.readMonthConfig('2026-09'), undefined);
    await assert.rejects(
      data.updateHorizon({ period: '2026-09', horizonDate: '2026-10-01' }),
      /active month config.*2026-09.*not found/i
    );
  } finally {
    database.close();
  }
});

test('malformed period, date, and money inputs leave existing rows unchanged', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createMonthConfigData(createProxyDatabase(database));
    const created = await data.openPeriod({
      period: '2026-09',
      openingBalance: 1_000,
      incomeTotal: 2_000,
      reservedTotal: 3_000,
    });
    const beforeCount = (
      database.prepare('SELECT COUNT(*) AS count FROM month_config').get() as { count: number }
    ).count;
    const before = monthConfigRow(database, created.period);
    assert.ok(before);

    const invalidInputs: unknown[] = [
      { period: '2026-9', openingBalance: 1, incomeTotal: 2, reservedTotal: 3 },
      { period: '2026-02-30', openingBalance: 1, incomeTotal: 2, reservedTotal: 3 },
      { period: '2026-09', openingBalance: -1, incomeTotal: 2, reservedTotal: 3 },
      { period: '2026-09', openingBalance: 1.5, incomeTotal: 2, reservedTotal: 3 },
      {
        period: '2026-09',
        openingBalance: Number.MAX_SAFE_INTEGER + 1,
        incomeTotal: 2,
        reservedTotal: 3,
      },
      { period: '2026-09', openingBalance: 1, incomeTotal: 2, reservedTotal: 3, horizonDate: '2026-08-31' },
    ];
    for (const invalid of invalidInputs) {
      await assert.rejects(data.openPeriod(invalid));
    }
    for (const invalid of [
      { period: '2026-9', horizonDate: '2026-10-01' },
      { period: '2026-09', horizonDate: '2026-09-31' },
      { period: '2026-09', horizonDate: '2026-08-31' },
    ]) {
      await assert.rejects(data.updateHorizon(invalid));
    }
    const afterCount = (
      database.prepare('SELECT COUNT(*) AS count FROM month_config').get() as { count: number }
    ).count;
    assert.equal(afterCount, beforeCount);
    assert.deepEqual(monthConfigRow(database, created.period), before);
  } finally {
    database.close();
  }
});

test('past month snapshot remains frozen when transactions and commitments change', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const monthData = createMonthConfigData(proxy);
    const transactionData = createTransactionData(proxy, createCategoryData(proxy));
    const commitmentData = createCommitmentData(proxy);
    const past = await monthData.openPeriod({
      period: '2025-01',
      openingBalance: 5_000_000,
      incomeTotal: 3_000_000,
      reservedTotal: 700_000,
    });
    const before = await monthData.readMonthConfig(past.period);
    assert.ok(before);
    const transaction = await transactionData.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'complete',
      amount: 45_000,
      categoryId: groceriesId(database),
      occurredAt: new Date('2025-01-10T00:00:00.000Z'),
    });
    await transactionData.editTransaction({
      transactionId: transaction.id,
      changes: { amount: 50_000 },
    });
    const commitment = await commitmentData.createCommitment({
      name: 'Rent',
      amount: 700_000,
      dueDay: 5,
      categoryId: rentReserveId(database),
    });
    await commitmentData.editCommitment({
      commitmentId: commitment.id,
      changes: { amount: 800_000 },
    });
    await commitmentData.editCommitment({
      commitmentId: commitment.id,
      changes: { active: false },
    });
    assert.deepEqual(await monthData.readMonthConfig(past.period), before);
  } finally {
    database.close();
  }
});
