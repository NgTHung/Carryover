import { strict as assert } from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createAccountData } from '../src/data/accounts';
import { createCategoryData } from '../src/data/categories';
import { createMonthConfigData } from '../src/data/month-config';
import { createManualTransactionData } from '../src/data/manual-transactions';
import { createTransactionData } from '../src/data/transactions';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const now = new Date(2026, 8, 15, 12);

test('manual income survives a close and reopen through public data APIs', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'carryover-period-'));
  const databasePath = join(directory, 'carryover.db');
  try {
    const firstDatabase = openMigratedDatabase(databasePath);
    const firstProxy = createProxyDatabase(firstDatabase);
    const firstData = createManualTransactionData(
      firstProxy,
      createCategoryData(firstProxy),
      undefined,
      { now: () => now }
    );
    const bank = (
      firstDatabase.prepare("SELECT id FROM accounts WHERE name = 'Bank'").get() as { id: string }
    ).id;
    const created = await firstData.createTransaction({
      accountId: bank,
      direction: 'income',
      status: 'complete',
      amount: 800,
      occurredAt: now,
      sourceLabel: 'Salary',
    });
    firstDatabase.close();

    const reopened = new DatabaseSync(databasePath);
    reopened.exec('PRAGMA foreign_keys = ON;');
    try {
      const proxy = createProxyDatabase(reopened);
      const transactionData = createTransactionData(proxy, createCategoryData(proxy));
      const monthConfig = createMonthConfigData(proxy);
      const accounts = createAccountData(proxy);
      assert.deepEqual(await transactionData.readTransaction(created.id), created);
      assert.equal((await monthConfig.readMonthConfig('2026-09'))?.incomeTotal, 800);
      assert.equal((await accounts.readAccountBalances()).find(({ accountId }) => accountId === bank)?.balance, 800);
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
