import { strict as assert } from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { MAX_VND_AMOUNT } from '../src/money/currency';

type Row = Record<string, unknown>;

const initialMigration = readFileSync(
  resolve(process.cwd(), 'drizzle/0000_initial-ledger.sql'),
  'utf8'
);
const boundsMigration = readFileSync(
  resolve(process.cwd(), 'drizzle/0001_safe-amount-bounds.sql'),
  'utf8'
);
const maxSql = MAX_VND_AMOUNT.toString();
const unsafeSql = (BigInt(MAX_VND_AMOUNT) + 1n).toString();

type SeedIds = {
  bank: string;
  cash: string;
  category: string;
  contact: string;
  transaction: string;
  split: string;
  settlement: string;
  commitment: string;
  transfer: string;
};

function openDatabase(withBounds = true): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(initialMigration);
  if (withBounds) {
    database.exec(boundsMigration);
  }
  return database;
}

function idFor(database: DatabaseSync, query: string, ...params: string[]): string {
  const row = database.prepare(query).get(...params) as Row | undefined;
  if (!row || typeof row.id !== 'string') {
    throw new Error(`Expected an id for ${query}`);
  }
  return row.id;
}

function count(database: DatabaseSync, table: string): number {
  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as Row;
  if (typeof row.count !== 'number') {
    throw new Error(`Expected a numeric count for ${table}`);
  }
  return row.count;
}

function seedLedger(database: DatabaseSync): SeedIds {
  database
    .prepare(
      "INSERT INTO accounts (name, kind, opening_balance) VALUES ('Bank', 'bank', 1000), ('Cash', 'cash', 500)"
    )
    .run();
  const bank = idFor(database, "SELECT id FROM accounts WHERE name = 'Bank'");
  const cash = idFor(database, "SELECT id FROM accounts WHERE name = 'Cash'");

  database.prepare("INSERT INTO categories (name, kind) VALUES ('Food', 'spend')").run();
  const category = idFor(database, "SELECT id FROM categories WHERE name = 'Food'");
  database.prepare("INSERT INTO contacts (name) VALUES ('Lan')").run();
  const contact = idFor(database, "SELECT id FROM contacts WHERE name = 'Lan'");

  database
    .prepare(
      "INSERT INTO transactions (account_id, direction, amount, category_id, occurred_at, status) VALUES (?, 'expense', 1000, ?, 1735689600000, 'complete')"
    )
    .run(bank, category);
  const transaction = idFor(database, 'SELECT id FROM transactions');

  database
    .prepare(
      'INSERT INTO splits (transaction_id, contact_id, share_amount) VALUES (?, ?, 1000)'
    )
    .run(transaction, contact);
  const split = idFor(database, 'SELECT id FROM splits');
  database
    .prepare(
      "INSERT INTO settlements (contact_id, amount, occurred_at, direction) VALUES (?, 1000, 1735689600000, 'they_paid_me')"
    )
    .run(contact);
  const settlement = idFor(database, 'SELECT id FROM settlements');
  database
    .prepare(
      "INSERT INTO commitments (name, amount, due_day, category_id) VALUES ('Rent', 1000, 1, ?)"
    )
    .run(category);
  const commitment = idFor(database, "SELECT id FROM commitments WHERE name = 'Rent'");
  database
    .prepare(
      'INSERT INTO month_config (period, opening_balance, income_total, reserved_total, horizon_date) VALUES (\'2026-01\', 1000, 1000, 1000, \'2026-01-31\')'
    )
    .run();
  database
    .prepare(
      'INSERT INTO transfers (from_account_id, to_account_id, amount, occurred_at) VALUES (?, ?, 1000, 1735689600000)'
    )
    .run(bank, cash);
  const transfer = idFor(database, 'SELECT id FROM transfers');

  return {
    bank,
    cash,
    category,
    contact,
    transaction,
    split,
    settlement,
    commitment,
    transfer,
  };
}

test('safe-bound migration upgrades a populated ledger with foreign keys enabled', () => {
  const database = openDatabase(false);
  try {
    seedLedger(database);
    database.exec('BEGIN');
    database.exec(boundsMigration);
    database.exec('COMMIT');

    for (const table of [
      'accounts',
      'categories',
      'contacts',
      'transactions',
      'splits',
      'settlements',
      'commitments',
      'month_config',
      'transfers',
    ]) {
      assert.ok(count(database, table) > 0, `${table} rows should survive the upgrade`);
    }
    assert.equal(database.prepare('PRAGMA foreign_keys').get()?.foreign_keys, 1);
  } finally {
    database.close();
  }
});

test('safe-bound migration rejects existing unsafe values in every amount column', () => {
  const unsafeUpdates = [
    ['accounts', 'opening_balance'],
    ['transactions', 'amount'],
    ['splits', 'share_amount'],
    ['settlements', 'amount'],
    ['commitments', 'amount'],
    ['month_config', 'opening_balance'],
    ['month_config', 'income_total'],
    ['month_config', 'reserved_total'],
    ['transfers', 'amount'],
  ] as const;

  for (const [table, column] of unsafeUpdates) {
    const database = openDatabase(false);
    try {
      seedLedger(database);
      database.exec(`UPDATE ${table} SET ${column} = ${unsafeSql}`);
      database.exec('BEGIN');
      assert.throws(
        () => database.exec(boundsMigration),
        /existing_ledger_amount_exceeds_safe_vnd|constraint/i,
        `${table}.${column} should stop the migration`
      );
      database.exec('ROLLBACK');

      assert.equal(
        database.prepare('SELECT COUNT(*) AS count FROM sqlite_master WHERE type = \'trigger\' AND name LIKE \'%_safe_max_%\'').get()?.count,
        0,
        `${table}.${column} should not leave partial protections`
      );
    } finally {
      database.close();
    }
  }
});

test('direct SQL inserts reject values above the safe VND bound in every amount column', () => {
  const database = openDatabase();
  try {
    const ids = seedLedger(database);
    const insertCases: Array<{
      table: string;
      insert: (amountLiteral: string) => void;
    }> = [
      {
        table: 'accounts',
        insert: (amountLiteral) =>
          database
            .prepare(
              `INSERT INTO accounts (name, kind, opening_balance) VALUES ('Account ${amountLiteral}', 'bank', ${amountLiteral})`
            )
            .run(),
      },
      {
        table: 'transactions',
        insert: (amountLiteral) =>
          database
            .prepare(
              `INSERT INTO transactions (account_id, direction, amount, occurred_at, status) VALUES (?, 'expense', ${amountLiteral}, 1735689600000, 'draft')`
            )
            .run(ids.bank),
      },
      {
        table: 'splits',
        insert: (amountLiteral) =>
          database
            .prepare(
              `INSERT INTO splits (transaction_id, contact_id, share_amount) VALUES (?, ?, ${amountLiteral})`
            )
            .run(ids.transaction, ids.contact),
      },
      {
        table: 'settlements',
        insert: (amountLiteral) =>
          database
            .prepare(
              `INSERT INTO settlements (contact_id, amount, occurred_at, direction) VALUES (?, ${amountLiteral}, 1735689600000, 'they_paid_me')`
            )
            .run(ids.contact),
      },
      {
        table: 'commitments',
        insert: (amountLiteral) =>
          database
            .prepare(
              `INSERT INTO commitments (name, amount, due_day, category_id) VALUES ('Commitment ${amountLiteral}', ${amountLiteral}, 1, ?)`
            )
            .run(ids.category),
      },
      {
        table: 'month_config',
        insert: (amountLiteral) =>
          database
            .prepare(
              `INSERT INTO month_config (period, opening_balance, income_total, reserved_total, horizon_date) VALUES ('${amountLiteral}-01', ${amountLiteral}, 1000, 1000, '2026-01-31')`
            )
            .run(),
      },
      {
        table: 'month_config',
        insert: (amountLiteral) =>
          database
            .prepare(
              `INSERT INTO month_config (period, opening_balance, income_total, reserved_total, horizon_date) VALUES ('2026-02', 1000, ${amountLiteral}, 1000, '2026-02-28')`
            )
            .run(),
      },
      {
        table: 'month_config',
        insert: (amountLiteral) =>
          database
            .prepare(
              `INSERT INTO month_config (period, opening_balance, income_total, reserved_total, horizon_date) VALUES ('2026-03', 1000, 1000, ${amountLiteral}, '2026-03-31')`
            )
            .run(),
      },
      {
        table: 'transfers',
        insert: (amountLiteral) =>
          database
            .prepare(
              `INSERT INTO transfers (from_account_id, to_account_id, amount, occurred_at) VALUES (?, ?, ${amountLiteral}, 1735689600000)`
            )
            .run(ids.bank, ids.cash),
      },
    ];

    for (const [index, testCase] of insertCases.entries()) {
      const beforeValid = count(database, testCase.table);
      testCase.insert(maxSql);
      assert.equal(count(database, testCase.table), beforeValid + 1, `case ${index} accepts max`);

      const beforeUnsafe = count(database, testCase.table);
      assert.throws(() => testCase.insert(unsafeSql), /safe VND|constraint/i);
      assert.equal(count(database, testCase.table), beforeUnsafe, `case ${index} rejects unsafe`);
    }
  } finally {
    database.close();
  }
});

test('direct SQL updates accept the maximum and reject larger values in every amount column', () => {
  const database = openDatabase();
  try {
    const ids = seedLedger(database);
    const amountColumns = [
      ['accounts', 'opening_balance', 'id = ?', ids.bank],
      ['transactions', 'amount', 'id = ?', ids.transaction],
      ['splits', 'share_amount', 'id = ?', ids.split],
      ['settlements', 'amount', 'id = ?', ids.settlement],
      ['commitments', 'amount', 'id = ?', ids.commitment],
      ['month_config', 'opening_balance', 'period = ?', '2026-01'],
      ['month_config', 'income_total', 'period = ?', '2026-01'],
      ['month_config', 'reserved_total', 'period = ?', '2026-01'],
      ['transfers', 'amount', 'id = ?', ids.transfer],
    ] as const;

    for (const [table, column, where, whereValue] of amountColumns) {
      const update = (literal: string) =>
        database.prepare(`UPDATE ${table} SET ${column} = ${literal} WHERE ${where}`).run(whereValue);
      const read = () =>
        (database.prepare(`SELECT ${column} AS value FROM ${table} WHERE ${where}`).get(whereValue) as Row)
          .value;

      update(maxSql);
      assert.equal(read(), MAX_VND_AMOUNT, `${table}.${column} accepts max`);
      assert.throws(() => update(unsafeSql), /safe VND|constraint/i);
      assert.equal(read(), MAX_VND_AMOUNT, `${table}.${column} keeps max after rejection`);
    }
  } finally {
    database.close();
  }
});
