import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { openMigratedDatabase } from './support/sqlite-proxy';

type AccountRow = {
  name: unknown;
  kind: unknown;
  is_default: unknown;
  opening_balance: unknown;
};

const seedMigration = readFileSync(
  resolve(process.cwd(), 'drizzle/0002_seed-accounts.sql'),
  'utf8'
);

test('the first-run migration seeds bank and cash with bank as default', () => {
  const database = openMigratedDatabase();
  try {
    const accounts = database
      .prepare(
        'SELECT name, kind, is_default, opening_balance FROM accounts WHERE deleted_at IS NULL ORDER BY kind'
      )
      .all() as AccountRow[];

    assert.equal(accounts.length, 2);
    assert.equal(accounts[0]?.name, 'Bank');
    assert.equal(accounts[0]?.kind, 'bank');
    assert.equal(accounts[0]?.is_default, 1);
    assert.equal(accounts[0]?.opening_balance, 0);
    assert.equal(accounts[1]?.name, 'Cash');
    assert.equal(accounts[1]?.kind, 'cash');
    assert.equal(accounts[1]?.is_default, 0);
    assert.equal(accounts[1]?.opening_balance, 0);
  } finally {
    database.close();
  }
});

test('the account seed does not duplicate active rows if applied again', () => {
  const database = openMigratedDatabase();
  try {
    database.exec(seedMigration);

    const result = database
      .prepare("SELECT COUNT(*) AS count FROM accounts WHERE deleted_at IS NULL")
      .get() as { count: unknown };
    assert.equal(result.count, 2);
  } finally {
    database.close();
  }
});
