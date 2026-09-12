import { strict as assert } from 'node:assert';

import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createMonthConfigData } from '../src/data/month-config';
import { createMonthSummaryData } from '../src/data/month-summary';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

function idFor(database: ReturnType<typeof openMigratedDatabase>, query: string): string {
  const row = database.prepare(query).get() as { id: string } | undefined;
  if (row === undefined) throw new Error(`Missing id for ${query}`);
  return row.id;
}

test('reads the stored config and aggregates only reportable period spending', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const notifier = createLedgerChangeNotifier();
    const monthConfigData = createMonthConfigData(proxy, notifier);
    const summaryData = createMonthSummaryData(proxy);
    const bankId = idFor(database, "SELECT id FROM accounts WHERE name = 'Bank'");
    const cashId = idFor(database, "SELECT id FROM accounts WHERE name = 'Cash'");
    const groceriesId = idFor(
      database,
      "SELECT id FROM categories WHERE name = 'Groceries' AND deleted_at IS NULL"
    );
    const foodId = idFor(
      database,
      "SELECT parent_id AS id FROM categories WHERE name = 'Groceries' AND deleted_at IS NULL"
    );
    const transactionDate = new Date(2026, 8, 15, 10).getTime();
    const splitId = '33333333-3333-4333-8333-333333333333';
    const unknownId = '33333333-3333-4333-8333-333333333334';
    const knownDraftId = '33333333-3333-4333-8333-333333333335';
    const contactId = '44444444-4444-4444-8444-444444444444';

    await monthConfigData.openPeriod({
      period: '2026-09',
      openingBalance: 4_000_000,
      incomeTotal: 2_000_000,
      reservedTotal: 900_000,
      horizonDate: '2026-09-28',
    });
    database.prepare('INSERT INTO contacts (id, name) VALUES (?, ?)').run(contactId, 'Alex');
    database
      .prepare(
        `INSERT INTO transactions
          (id, account_id, direction, amount, category_id, quality, occurred_at, status)
         VALUES (?, ?, 'expense', 100000, ?, 'need', ?, 'complete')`
      )
      .run(splitId, bankId, groceriesId, transactionDate);
    database
      .prepare(
        `INSERT INTO transactions
          (id, account_id, direction, amount, category_id, occurred_at, status)
         VALUES (?, ?, 'expense', NULL, NULL, ?, 'draft')`
      )
      .run(unknownId, bankId, transactionDate);
    database
      .prepare(
        `INSERT INTO transactions
          (id, account_id, direction, amount, category_id, occurred_at, status)
         VALUES (?, ?, 'expense', 50000, NULL, ?, 'draft')`
      )
      .run(knownDraftId, bankId, transactionDate);
    database
      .prepare(
        `INSERT INTO transactions
          (id, account_id, direction, amount, category_id, occurred_at, status)
         VALUES (?, ?, 'income', 900000, NULL, ?, 'complete')`
      )
      .run('33333333-3333-4333-8333-333333333336', bankId, transactionDate);
    database
      .prepare(
        `INSERT INTO transactions
          (id, account_id, direction, adjustment_effect, amount, category_id, occurred_at, status)
         VALUES (?, ?, 'adjustment', 'increase', 800000, NULL, ?, 'complete')`
      )
      .run('33333333-3333-4333-8333-333333333337', bankId, transactionDate);
    database
      .prepare(
        `INSERT INTO transactions
          (id, account_id, direction, amount, category_id, occurred_at, status)
         VALUES (?, ?, 'transfer', 700000, NULL, ?, 'complete')`
      )
      .run('33333333-3333-4333-8333-333333333338', bankId, transactionDate);
    database
      .prepare(
        `INSERT INTO splits (id, transaction_id, contact_id, share_amount)
         VALUES (?, ?, ?, ?)`
      )
      .run('55555555-5555-4555-8555-555555555551', splitId, null, 30_000);
    database
      .prepare(
        `INSERT INTO splits (id, transaction_id, contact_id, share_amount)
         VALUES (?, ?, ?, ?)`
      )
      .run('55555555-5555-4555-8555-555555555552', splitId, contactId, 70_000);
    database
      .prepare(
        `INSERT INTO transfers (id, from_account_id, to_account_id, amount, occurred_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run('66666666-6666-4666-8666-666666666661', bankId, cashId, 1_000_000, transactionDate);

    database
      .prepare('UPDATE categories SET deleted_at = ? WHERE id IN (?, ?)')
      .run(transactionDate, groceriesId, foodId);

    const summary = await summaryData.readMonthSummary('2026-09');
    assert.ok(summary);
    assert.deepEqual(summary.monthConfig, {
      period: '2026-09',
      openingBalance: 4_000_000,
      incomeTotal: 2_000_000,
      reservedTotal: 900_000,
      horizonDate: '2026-09-28',
    });
    assert.equal(summary.totalSpent, 80_000);
    assert.equal(summary.regrettedTotal, 0);
    assert.equal(summary.unknownDrafts, 1);
    assert.deepEqual(summary.groups.map(({ name, amount }) => ({ name, amount })), [
      { name: 'Food', amount: 30_000 },
      { name: 'No group yet', amount: 50_000 },
    ].sort((left, right) => right.amount - left.amount));
    assert.equal(summary.quality[0]?.amount, 30_000);
    assert.equal(summary.quality[3]?.amount, 50_000);
  } finally {
    database.close();
  }
});

test('missing month config produces no report instead of recomputing one', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createMonthSummaryData(createProxyDatabase(database));
    assert.equal(await data.readMonthSummary('2026-09'), undefined);
  } finally {
    database.close();
  }
});

test('reads selected days and complete reference periods for history charts', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const data = createMonthSummaryData(proxy);
    const bankId = idFor(database, "SELECT id FROM accounts WHERE name = 'Bank'");
    const groceriesId = idFor(
      database,
      "SELECT id FROM categories WHERE name = 'Groceries' AND deleted_at IS NULL"
    );
    const contactId = '44444444-4444-4444-8444-444444444444';
    database
      .prepare('INSERT INTO contacts (id, name) VALUES (?, ?)')
      .run(contactId, 'Alex');
    const periods = [
      ['2026-07', 1_000_000, 0, 0, '2026-07-31'],
      ['2026-08', 1_000_000, 0, 0, '2026-08-31'],
      ['2026-09', 2_000_000, 1_000_000, 0, '2026-09-30'],
    ] as const;
    for (const [period, openingBalance, incomeTotal, reservedTotal, horizonDate] of periods) {
      database
        .prepare(
          `INSERT INTO month_config
            (period, opening_balance, income_total, reserved_total, horizon_date)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(period, openingBalance, incomeTotal, reservedTotal, horizonDate);
    }

    const insertExpense = (
      id: string,
      amount: number,
      occurredAt: number,
      categoryId: string | null = groceriesId
    ) => {
      database
        .prepare(
          `INSERT INTO transactions
            (id, account_id, direction, amount, category_id, occurred_at, status)
           VALUES (?, ?, 'expense', ?, ?, ?, 'complete')`
        )
        .run(id, bankId, amount, categoryId, occurredAt);
    };

    insertExpense('77777777-7777-4777-8777-777777777701', 100, new Date(2026, 6, 1, 10).getTime());
    insertExpense('77777777-7777-4777-8777-777777777702', 400, new Date(2026, 6, 15, 10).getTime());
    insertExpense('77777777-7777-4777-8777-777777777703', 200, new Date(2026, 7, 1, 10).getTime());
    insertExpense('77777777-7777-4777-8777-777777777704', 300, new Date(2026, 7, 15, 10).getTime());
    insertExpense('77777777-7777-4777-8777-777777777705', 300, new Date(2026, 8, 1, 10).getTime());

    const splitId = '77777777-7777-4777-8777-777777777706';
    insertExpense(splitId, 1_000, new Date(2026, 8, 14, 10).getTime());
    database
      .prepare(
        `INSERT INTO splits (id, transaction_id, contact_id, share_amount)
         VALUES (?, ?, ?, ?)`
      )
      .run('88888888-8888-4888-8888-888888888801', splitId, null, 250);
    database
      .prepare(
        `INSERT INTO splits (id, transaction_id, contact_id, share_amount)
         VALUES (?, ?, ?, ?)`
      )
      .run(
        '88888888-8888-4888-8888-888888888802',
        splitId,
        contactId,
        750
      );

    database
      .prepare(
        `INSERT INTO transactions
          (id, account_id, direction, amount, occurred_at, status)
         VALUES (?, ?, 'income', ?, ?, 'complete')`
      )
      .run(
        '77777777-7777-4777-8777-777777777707',
        bankId,
        900,
        new Date(2026, 8, 15, 10).getTime()
      );
    database
      .prepare(
        `INSERT INTO transactions
          (id, account_id, direction, amount, category_id, occurred_at, status)
         VALUES (?, ?, 'expense', ?, ?, ?, 'complete')`
      )
      .run(
        '77777777-7777-4777-8777-777777777708',
        bankId,
        700,
        groceriesId,
        new Date(2026, 8, 16, 10).getTime()
      );
    database
      .prepare(
        `INSERT INTO transactions
          (id, account_id, direction, amount, occurred_at, status)
         VALUES (?, ?, 'transfer', ?, ?, 'complete')`
      )
      .run(
        '77777777-7777-4777-8777-777777777709',
        bankId,
        800,
        new Date(2026, 8, 15, 11).getTime()
      );
    database
      .prepare(
        `INSERT INTO transactions
          (id, account_id, direction, adjustment_effect, amount, occurred_at, status)
         VALUES (?, ?, 'adjustment', 'increase', ?, ?, 'complete')`
      )
      .run(
        '77777777-7777-4777-8777-777777777710',
        bankId,
        500,
        new Date(2026, 8, 15, 12).getTime()
      );
    database
      .prepare(
        `INSERT INTO transactions
          (id, account_id, direction, amount, occurred_at, status)
         VALUES (?, ?, 'expense', NULL, ?, 'draft')`
      )
      .run(
        '77777777-7777-4777-8777-777777777711',
        bankId,
        new Date(2026, 8, 12, 10).getTime()
      );

    const deletedId = '77777777-7777-4777-8777-777777777712';
    insertExpense(deletedId, 999, new Date(2026, 8, 2, 10).getTime());
    database
      .prepare('UPDATE transactions SET deleted_at = ? WHERE id = ?')
      .run(new Date(2026, 8, 3, 10).getTime(), deletedId);

    const summary = await data.readMonthSummary('2026-09', '2026-09-15');
    assert.ok(summary);
    assert.equal(summary.history.perDay, 103_448);
    assert.equal(summary.history.actualPoints.length, 15);
    assert.equal(summary.history.actualPoints[14]?.amount, 550);
    assert.equal(summary.history.days[0]?.spend, 300);
    assert.equal(summary.history.days[13]?.spend, 250);
    assert.equal(summary.history.days[14]?.income, 900);
    assert.equal(summary.history.days[15]?.phase, 'future');
    assert.equal(summary.history.days[15]?.spend, 0);
    assert.equal(summary.history.days[11]?.unknownDrafts, 1);
    assert.deepEqual(
      summary.history.days[14]?.transactions.map(({ direction, amount }) => ({ direction, amount })),
      [{ direction: 'income', amount: 900 }]
    );
    assert.equal(summary.history.reference.status, 'available');
    if (summary.history.reference.status === 'available') {
      assert.equal(summary.history.reference.label, '2-period median');
      assert.equal(summary.history.reference.sampleCount, 2);
      assert.equal(summary.history.reference.points[0]?.amount, 150);
      assert.equal(summary.history.reference.points[14]?.amount, 500);
    }
    assert.deepEqual(summary.history.gap, {
      relation: 'above',
      amount: 50,
      day: 15,
    });
  } finally {
    database.close();
  }
});
