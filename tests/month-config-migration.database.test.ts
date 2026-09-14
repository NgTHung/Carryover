import { strict as assert } from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function openBeforeSignedOpeningMigration(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  for (const migration of [
    '0000_initial-ledger.sql',
    '0001_safe-amount-bounds.sql',
    '0002_seed-accounts.sql',
    '0003_repair-cash-account.sql',
    '0004_seed-categories.sql',
    '0005_adjustment-effect.sql',
  ]) {
    database.exec(readFileSync(resolve(process.cwd(), 'drizzle', migration), 'utf8'));
  }
  return database;
}

test('signed month opening migration preserves stored snapshots and admits overdrawn openings', () => {
  const database = openBeforeSignedOpeningMigration();
  try {
    database
      .prepare(
        `INSERT INTO month_config
          (period, opening_balance, income_total, reserved_total, horizon_date)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run('2026-08', 1_000, 2_000, 300, '2026-08-31');

    database.exec(
      readFileSync(resolve(process.cwd(), 'drizzle/0006_icy_ronan.sql'), 'utf8')
    );

    const before = database
      .prepare("SELECT opening_balance, income_total, reserved_total, horizon_date FROM month_config WHERE period = '2026-08'")
      .get() as {
        opening_balance: number;
        income_total: number;
        reserved_total: number;
        horizon_date: string;
      };
    assert.equal(before.opening_balance, 1_000);
    assert.equal(before.income_total, 2_000);
    assert.equal(before.reserved_total, 300);
    assert.equal(before.horizon_date, '2026-08-31');

    database
      .prepare("UPDATE month_config SET opening_balance = -500 WHERE period = '2026-08'")
      .run();
    const after = database
      .prepare("SELECT opening_balance FROM month_config WHERE period = '2026-08'")
      .get() as { opening_balance: number };
    assert.equal(after.opening_balance, -500);
  } finally {
    database.close();
  }
});
