import { strict as assert } from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const initialMigration = readFileSync(
  resolve(process.cwd(), 'drizzle/0000_initial-ledger.sql'),
  'utf8'
);
const adjustmentMigration = readFileSync(
  resolve(process.cwd(), 'drizzle/0005_adjustment-effect.sql'),
  'utf8'
);

function openLegacyDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(initialMigration);
  return database;
}

function addBank(database: DatabaseSync): string {
  const row = database
    .prepare(
      "INSERT INTO accounts (name, kind, opening_balance) VALUES ('Bank', 'bank', 0) RETURNING id"
    )
    .get() as { id: unknown };
  if (typeof row.id !== 'string') {
    throw new Error('Bank account did not return an id');
  }
  return row.id;
}

test('adjustment migration adds the effect column and enforces its direction', () => {
  const database = openLegacyDatabase();
  try {
    database.exec(adjustmentMigration);
    const accountId = addBank(database);

    database
      .prepare(
        "INSERT INTO transactions (account_id, direction, adjustment_effect, amount, occurred_at, status) VALUES (?, 'adjustment', 'increase', 1, 0, 'complete')"
      )
      .run(accountId);
    database
      .prepare(
        "INSERT INTO transactions (account_id, direction, amount, occurred_at, status) VALUES (?, 'expense', 1, 0, 'complete')"
      )
      .run(accountId);

    assert.throws(() =>
      database
        .prepare(
          "INSERT INTO transactions (account_id, direction, amount, occurred_at, status) VALUES (?, 'adjustment', 1, 0, 'complete')"
        )
        .run(accountId)
    );
    assert.throws(() =>
      database
        .prepare(
          "INSERT INTO transactions (account_id, direction, adjustment_effect, amount, occurred_at, status) VALUES (?, 'expense', 'decrease', 1, 0, 'complete')"
        )
        .run(accountId)
    );
  } finally {
    database.close();
  }
});

test('adjustment migration aborts before schema changes for active or deleted legacy adjustments', () => {
  for (const deletedAt of [null, 1735689600000]) {
    const database = openLegacyDatabase();
    try {
      const accountId = addBank(database);
      database
        .prepare(
          "INSERT INTO transactions (account_id, direction, amount, occurred_at, status, deleted_at) VALUES (?, 'adjustment', 1, 0, 'complete', ?)"
        )
        .run(accountId, deletedAt);

      assert.throws(
        () => database.exec(adjustmentMigration),
        /legacy_adjustments_need_effect/
      );
      const columns = database
        .prepare('PRAGMA table_info(transactions)')
        .all() as Array<{ name: unknown }>;
      assert.equal(
        columns.some((column) => column.name === 'adjustment_effect'),
        false,
        deletedAt === null
          ? 'active legacy adjustment must leave the schema unchanged'
          : 'deleted legacy adjustment must leave the schema unchanged'
      );
    } finally {
      database.close();
    }
  }
});
