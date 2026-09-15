import { strict as assert } from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { readBudgetInput } from '../src/budget/snapshot-source';
import type { BudgetSnapshot } from '../src/budget/snapshot';
import { createSnapshotPublisher } from '../src/budget/snapshot-publisher';
import { createSnapshotStore } from '../src/budget/snapshot-store';
import { createAccountData } from '../src/data/accounts';
import { createCategoryData } from '../src/data/categories';
import { createCommitmentData } from '../src/data/commitments';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createMonthConfigData } from '../src/data/month-config';
import { createMonthSummaryData } from '../src/data/month-summary';
import { createShareData } from '../src/data/shares';
import { createTransactionData } from '../src/data/transactions';
import { createTransactionListData } from '../src/data/transaction-list';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const now = new Date(2026, 8, 15, 12);

function idFor(
  database: ReturnType<typeof openMigratedDatabase>,
  query: string
): string {
  const row = database.prepare(query).get() as { id: string } | undefined;
  if (row === undefined) throw new Error(`Missing id for ${query}`);
  return row.id;
}

function financialSnapshot(snapshot: BudgetSnapshot): Omit<BudgetSnapshot, 'updatedAt'> {
  const { updatedAt: _updatedAt, ...financial } = snapshot;
  return financial;
}

function createSnapshotHarness(database: DatabaseSync) {
  const proxy = createProxyDatabase(database);
  const silentNotifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
  const reads = {
    accounts: createAccountData(proxy, silentNotifier),
    commitments: createCommitmentData(proxy, silentNotifier),
    monthConfig: createMonthConfigData(proxy, silentNotifier),
    shares: createShareData(proxy),
    transactions: createTransactionData(
      proxy,
      createCategoryData(proxy, silentNotifier),
      silentNotifier
    ),
  };
  const written: BudgetSnapshot[] = [];
  const publisher = createSnapshotPublisher({
    now: () => now,
    store: createSnapshotStore(),
    readInput: (at) => readBudgetInput(reads, at),
    writer: (snapshot) => {
      written.push(snapshot);
    },
  });
  return { publisher, written };
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

test('transfer data survives close and reopen through fresh balances, list, detail, reports, and snapshot services', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'carryover-transfer-'));
  const databasePath = join(directory, 'carryover.db');
  let transferId: string | undefined;
  let beforeSummary: Awaited<ReturnType<ReturnType<typeof createMonthSummaryData>['readMonthSummary']>>;
  let beforeSnapshot: BudgetSnapshot | undefined;
  try {
    const firstDatabase = openMigratedDatabase(databasePath);
    try {
      const proxy = createProxyDatabase(firstDatabase);
      const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
      const accounts = createAccountData(proxy, notifier, { now: () => now });
      const monthConfigs = createMonthConfigData(proxy, notifier);
      const bankId = idFor(firstDatabase, "SELECT id FROM accounts WHERE name = 'Bank'");
      const cashId = idFor(firstDatabase, "SELECT id FROM accounts WHERE name = 'Cash'");
      firstDatabase.prepare('UPDATE accounts SET opening_balance = ? WHERE id = ?').run(950_000, bankId);
      firstDatabase.prepare('UPDATE accounts SET opening_balance = ? WHERE id = ?').run(250_000, cashId);
      await monthConfigs.openPeriod({
        period: '2026-09',
        openingBalance: 1_200_000,
        incomeTotal: 0,
        reservedTotal: 100_000,
        horizonDate: '2026-09-30',
      });

      const summaryData = createMonthSummaryData(proxy);
      beforeSummary = await summaryData.readMonthSummary('2026-09', '2026-09-15');
      assert.ok(beforeSummary);
      await accounts.recordTransfer({
        fromAccountId: bankId,
        toAccountId: cashId,
        amount: 200_000,
        occurredAt: now,
      });
      transferId = idFor(firstDatabase, 'SELECT id FROM transfers ORDER BY created_at DESC LIMIT 1');

      const balances = await accounts.readAccountBalances();
      assert.equal(balances.find(({ accountId }) => accountId === bankId)?.balance, 750_000);
      assert.equal(balances.find(({ accountId }) => accountId === cashId)?.balance, 450_000);
      assert.equal(
        (firstDatabase.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count,
        0
      );
      assert.equal(
        (firstDatabase.prepare('SELECT amount FROM transfers WHERE id = ?').get(transferId) as { amount: number }).amount,
        200_000
      );
      assert.deepEqual(await summaryData.readMonthSummary('2026-09', '2026-09-15'), beforeSummary);

      const listData = createTransactionListData(proxy, notifier);
      const rows = await listData.readTransactionList({
        period: '2026-09',
        categoryId: null,
        accountId: null,
        quality: null,
      });
      assert.equal(rows.filter((row) => row.kind === 'transfer' && row.source === 'transfers').length, 1);
      const detail = await accounts.readTransfer(transferId);
      assert.ok(detail);
      assert.equal(detail?.transfer.amount, 200_000);

      const snapshotHarness = createSnapshotHarness(firstDatabase);
      await snapshotHarness.publisher.refresh();
      beforeSnapshot = readySnapshot(snapshotHarness.publisher);
      assert.equal(snapshotHarness.written[0], beforeSnapshot);
    } finally {
      firstDatabase.close();
    }

    const reopened = new DatabaseSync(databasePath);
    reopened.exec('PRAGMA foreign_keys = ON;');
    try {
      const proxy = createProxyDatabase(reopened);
      const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
      const accounts = createAccountData(proxy, notifier, { now: () => now });
      const bankId = idFor(reopened, "SELECT id FROM accounts WHERE name = 'Bank'");
      const cashId = idFor(reopened, "SELECT id FROM accounts WHERE name = 'Cash'");
      if (transferId === undefined || beforeSummary === undefined || beforeSnapshot === undefined) {
        throw new Error('Missing pre-close transfer evidence');
      }

      const balances = await accounts.readAccountBalances();
      assert.equal(balances.find(({ accountId }) => accountId === bankId)?.balance, 750_000);
      assert.equal(balances.find(({ accountId }) => accountId === cashId)?.balance, 450_000);
      const listData = createTransactionListData(proxy, notifier);
      const rows = await listData.readTransactionList({
        period: '2026-09',
        categoryId: null,
        accountId: null,
        quality: null,
      });
      const transferRow = rows.find(
        (row) => row.kind === 'transfer' && row.source === 'transfers'
      );
      assert.ok(transferRow);
      if (transferRow === undefined || transferRow.kind !== 'transfer' || transferRow.source !== 'transfers') {
        throw new Error('Missing transfer row after reopen');
      }
      assert.equal(transferRow.transfer.id, transferId);
      const detail = await accounts.readTransfer(transferId);
      assert.deepEqual(detail, {
        transfer: transferRow.transfer,
        fromAccount: transferRow.fromAccount,
        toAccount: transferRow.toAccount,
      });
      assert.deepEqual(
        await createMonthSummaryData(proxy).readMonthSummary('2026-09', '2026-09-15'),
        beforeSummary
      );

      const snapshotHarness = createSnapshotHarness(reopened);
      await snapshotHarness.publisher.refresh();
      const afterSnapshot = readySnapshot(snapshotHarness.publisher);
      assert.deepEqual(financialSnapshot(afterSnapshot), financialSnapshot(beforeSnapshot));
      assert.equal(snapshotHarness.written[0], afterSnapshot);
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
