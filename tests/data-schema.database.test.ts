import { strict as assert } from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core/dialect';

import {
  assertPositiveVndAmount,
  assertVndInteger,
  CURRENCY_EXPONENT,
} from '../src/money/currency';
import { payerFromNullableId } from '../src/data/payer';
import { activeRowFilter } from '../src/data/soft-delete';
import { accounts } from '../src/data/schema';

type Row = Record<string, unknown>;

const migrationSql = readFileSync(
  resolve(process.cwd(), 'drizzle/0000_initial-ledger.sql'),
  'utf8'
);

const tableNames = [
  'accounts',
  'categories',
  'contacts',
  'transactions',
  'splits',
  'settlements',
  'commitments',
  'month_config',
  'transfers',
] as const;

function openMigratedDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(migrationSql);
  return database;
}

function rowId(database: DatabaseSync, table: string, name: string): string {
  const row = database
    .prepare(`SELECT id FROM ${table} WHERE name = ?`)
    .get(name) as Row | undefined;
  if (!row || typeof row.id !== 'string') {
    throw new Error(`Could not find ${table} row named ${name}`);
  }
  return row.id;
}

function count(database: DatabaseSync, table: string): number {
  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as Row;
  if (typeof row.count !== 'number') {
    throw new Error(`Count for ${table} was not numeric`);
  }
  return row.count;
}

function stringField(row: Row, field: string): string {
  const value = row[field];
  if (typeof value !== 'string') {
    throw new Error(`${field} was not text`);
  }
  return value;
}

test('migration creates the nine tables and their shared columns', () => {
  const database = openMigratedDatabase();
  try {
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as Row[];
    assert.deepEqual(
      [...tables.map((row) => row.name)].sort(),
      [...tableNames].sort()
    );

    for (const table of tableNames) {
      const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Row[];
      const names = columns.map((column) => column.name);
      assert.deepEqual(
        [...names.filter((name) =>
          ['id', 'created_at', 'updated_at', 'deleted_at'].includes(String(name))
        )],
        ['id', 'created_at', 'updated_at', 'deleted_at']
      );
      for (const columnName of ['id', 'created_at', 'updated_at', 'deleted_at']) {
        const column = columns.find((candidate) => candidate.name === columnName);
        if (!column) {
          throw new Error(`${table} is missing ${columnName}`);
        }
        assert.equal(String(column.type).toUpperCase(), columnName === 'id' ? 'TEXT' : 'INTEGER');
      }
    }

    const transactionColumns = database.prepare('PRAGMA table_info(transactions)').all() as Row[];
    const transactionColumn = transactionColumns.find((column) => column.name === 'note');
    if (!transactionColumn) {
      throw new Error('transactions is missing note');
    }
    assert.equal(transactionColumn.type, 'TEXT');
    assert.equal(transactionColumn.notnull, 0);
    const payerColumn = transactionColumns.find(
      (column) => column.name === 'payer_contact_id'
    );
    if (!payerColumn) {
      throw new Error('transactions is missing payer_contact_id');
    }
    assert.equal(payerColumn.type, 'TEXT');
    assert.equal(payerColumn.notnull, 0);
    assert.equal(database.prepare('PRAGMA foreign_keys').get()?.foreign_keys, 1);
  } finally {
    database.close();
  }
});

test('one row per table reads back, including transaction notes and payer meaning', () => {
  const database = openMigratedDatabase();
  try {
    database
      .prepare(
        "INSERT INTO accounts (name, kind, opening_balance) VALUES ('Bank', 'bank', 1000000), ('Cash', 'cash', 250000)"
      )
      .run();
    const bankId = rowId(database, 'accounts', 'Bank');
    const cashId = rowId(database, 'accounts', 'Cash');

    database
      .prepare(
        "INSERT INTO categories (name, kind, is_suggestion) VALUES ('Food', 'spend', 1)"
      )
      .run();
    const foodId = rowId(database, 'categories', 'Food');
    database
      .prepare(
        "INSERT INTO categories (parent_id, name, kind) VALUES (?, 'Eating out', 'spend')"
      )
      .run(foodId);
    const leafId = rowId(database, 'categories', 'Eating out');

    database.prepare("INSERT INTO contacts (name) VALUES ('Lan')").run();
    const contactId = rowId(database, 'contacts', 'Lan');

    database
      .prepare(
        "INSERT INTO transactions (account_id, direction, occurred_at, status, note) VALUES (?, 'expense', 1735689600000, 'draft', ?)"
      )
      .run(bankId, 'Chờ bổ sung ☕');
    const draftId = database
      .prepare("SELECT id FROM transactions WHERE status = 'draft'")
      .get() as Row;
    const draftIdValue = stringField(draftId, 'id');
    const draft = database
      .prepare('SELECT amount, note, payer_contact_id FROM transactions WHERE id = ?')
      .get(draftIdValue) as Row;
    assert.equal(draft.amount, null);
    assert.equal(draft.note, 'Chờ bổ sung ☕');
    assert.deepEqual(payerFromNullableId(draft.payer_contact_id as string | null), { kind: 'you' });

    database
      .prepare(
        "INSERT INTO transactions (account_id, direction, amount, category_id, payer_contact_id, occurred_at, status, note, source_label) VALUES (?, 'expense', 45000, ?, ?, 1735689600000, 'complete', ?, NULL)"
      )
      .run(bankId, leafId, contactId, 'Bữa trưa với Lan');
    const transactionId = database
      .prepare("SELECT id FROM transactions WHERE status = 'complete'")
      .get() as Row;
    const transactionIdValue = stringField(transactionId, 'id');
    const complete = database
      .prepare('SELECT amount, note, payer_contact_id FROM transactions WHERE id = ?')
      .get(transactionIdValue) as Row;
    assert.equal(complete.amount, 45000);
    assert.equal(complete.note, 'Bữa trưa với Lan');
    assert.deepEqual(payerFromNullableId(complete.payer_contact_id as string | null), {
      kind: 'contact',
      contactId,
    });

    database
      .prepare(
        'INSERT INTO splits (transaction_id, contact_id, share_amount) VALUES (?, NULL, 45000)'
      )
      .run(transactionIdValue);
    database
      .prepare(
        "INSERT INTO settlements (contact_id, amount, occurred_at, direction, note) VALUES (?, 20000, 1735689600000, 'they_paid_me', 'Partial')"
      )
      .run(contactId);
    database
      .prepare(
        "INSERT INTO commitments (name, amount, due_day, category_id) VALUES ('Rent', 800000, 1, ?)"
      )
      .run(leafId);
    database
      .prepare(
        "INSERT INTO month_config (period, opening_balance, income_total, reserved_total, horizon_date) VALUES ('2026-01', 1250000, 0, 800000, '2026-01-31')"
      )
      .run();
    database
      .prepare(
        'INSERT INTO transfers (from_account_id, to_account_id, amount, occurred_at) VALUES (?, ?, 50000, 1735689600000)'
      )
      .run(bankId, cashId);

    for (const table of tableNames) {
      assert.ok(count(database, table) > 0, `${table} should contain a row`);
    }
    const accountRows = database.prepare('SELECT id, created_at, updated_at FROM accounts').all() as Row[];
    assert.match(String(accountRows[0]?.id), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(typeof accountRows[0]?.created_at, 'number');
    assert.equal(typeof accountRows[0]?.updated_at, 'number');
  } finally {
    database.close();
  }
});

test('currency guards reject fractional values without rounding', () => {
  assert.equal(CURRENCY_EXPONENT, 0);
  assert.throws(() => assertVndInteger(12.5), /integer VND amount/);
  assert.throws(() => assertPositiveVndAmount(12.5), /integer VND amount/);
  assert.throws(() => assertPositiveVndAmount(0), /positive/);

  const database = openMigratedDatabase();
  try {
    assert.throws(
      () =>
        database
          .prepare("INSERT INTO accounts (name, kind, opening_balance) VALUES ('Float', 'bank', ?)")
          .run(12.5),
      /constraint/i
    );
    assert.equal(count(database, 'accounts'), 0);
  } finally {
    database.close();
  }
});

test('all ledger amount columns use SQLite INTEGER storage', () => {
  const database = openMigratedDatabase();
  try {
    const amountColumns = [
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

    for (const [table, columnName] of amountColumns) {
      const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Row[];
      const column = columns.find((candidate) => candidate.name === columnName);
      if (!column) {
        throw new Error(`${table} is missing ${columnName}`);
      }
      assert.equal(String(column.type).toUpperCase(), 'INTEGER');
    }
  } finally {
    database.close();
  }
});

test('SQLite rejects fractional writes in every amount-bearing column', () => {
  const database = openMigratedDatabase();
  try {
    database
      .prepare(
        "INSERT INTO accounts (name, kind, opening_balance) VALUES ('Bank', 'bank', 100000), ('Cash', 'cash', 50000)"
      )
      .run();
    const bankId = rowId(database, 'accounts', 'Bank');
    const cashId = rowId(database, 'accounts', 'Cash');
    database
      .prepare("INSERT INTO categories (name, kind) VALUES ('Food', 'spend')")
      .run();
    const categoryId = rowId(database, 'categories', 'Food');
    database
      .prepare("INSERT INTO contacts (name) VALUES ('Lan')")
      .run();
    const contactId = rowId(database, 'contacts', 'Lan');
    database
      .prepare(
        "INSERT INTO transactions (account_id, direction, amount, category_id, occurred_at, status) VALUES (?, 'expense', 1000, ?, 1735689600000, 'complete')"
      )
      .run(bankId, categoryId);
    const transactionId = stringField(
      database.prepare('SELECT id FROM transactions').get() as Row,
      'id'
    );
    database
      .prepare(
        'INSERT INTO splits (transaction_id, contact_id, share_amount) VALUES (?, ?, 1000)'
      )
      .run(transactionId, contactId);
    const splitId = stringField(
      database.prepare('SELECT id FROM splits').get() as Row,
      'id'
    );
    database
      .prepare(
        "INSERT INTO settlements (contact_id, amount, occurred_at, direction) VALUES (?, 1000, 1735689600000, 'they_paid_me')"
      )
      .run(contactId);
    const settlementId = stringField(
      database.prepare('SELECT id FROM settlements').get() as Row,
      'id'
    );
    database
      .prepare(
        "INSERT INTO commitments (name, amount, due_day, category_id) VALUES ('Rent', 1000, 1, ?)"
      )
      .run(categoryId);
    const commitmentId = stringField(
      database.prepare('SELECT id FROM commitments').get() as Row,
      'id'
    );
    database
      .prepare(
        "INSERT INTO month_config (period, opening_balance, income_total, reserved_total, horizon_date) VALUES ('2026-01', 1000, 1000, 1000, '2026-01-31')"
      )
      .run();
    database
      .prepare(
        'INSERT INTO transfers (from_account_id, to_account_id, amount, occurred_at) VALUES (?, ?, 1000, 1735689600000)'
      )
      .run(bankId, cashId);
    const transferId = stringField(
      database.prepare('SELECT id FROM transfers').get() as Row,
      'id'
    );

    const fractionalUpdates = [
      ['UPDATE accounts SET opening_balance = 12.5 WHERE id = ?', bankId],
      ['UPDATE transactions SET amount = 12.5 WHERE id = ?', transactionId],
      ['UPDATE splits SET share_amount = 12.5 WHERE id = ?', splitId],
      ['UPDATE settlements SET amount = 12.5 WHERE id = ?', settlementId],
      ['UPDATE commitments SET amount = 12.5 WHERE id = ?', commitmentId],
      ['UPDATE month_config SET opening_balance = 12.5 WHERE period = ?', '2026-01'],
      ['UPDATE month_config SET income_total = 12.5 WHERE period = ?', '2026-01'],
      ['UPDATE month_config SET reserved_total = 12.5 WHERE period = ?', '2026-01'],
      ['UPDATE transfers SET amount = 12.5 WHERE id = ?', transferId],
    ] as const;

    for (const [statement, id] of fractionalUpdates) {
      assert.throws(() => database.prepare(statement).run(id), /constraint/i);
    }
  } finally {
    database.close();
  }
});

test('normal reads hide soft-deleted rows and explicit reads include them', () => {
  const database = openMigratedDatabase();
  try {
    database
      .prepare("INSERT INTO accounts (name, kind, opening_balance) VALUES ('Hidden', 'bank', 1000)")
      .run();
    const hiddenId = rowId(database, 'accounts', 'Hidden');
    database.prepare('UPDATE accounts SET deleted_at = 1735689600000 WHERE id = ?').run(hiddenId);

    const dialect = new SQLiteSyncDialect();
    const filter = activeRowFilter(accounts.deletedAt);
    if (!filter) {
      throw new Error('Expected a default active-row filter');
    }
    const filterSql = dialect.sqlToQuery(filter).sql;
    const normalRows = database.prepare(`SELECT id FROM accounts WHERE ${filterSql}`).all();
    assert.equal(normalRows.length, 0);

    const includeDeletedFilter = activeRowFilter(accounts.deletedAt, { includeDeleted: true });
    assert.equal(includeDeletedFilter, undefined);
    const allRows = database.prepare('SELECT id FROM accounts').all();
    assert.equal(allRows.length, 1);
  } finally {
    database.close();
  }
});
