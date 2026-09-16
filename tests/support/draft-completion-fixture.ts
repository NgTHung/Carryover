import type { DatabaseSync } from 'node:sqlite';

import { readBudgetInput } from '../../src/budget/snapshot-source';
import type { BudgetSnapshot } from '../../src/budget/snapshot';
import { createSnapshotPublisher, type SnapshotPublisher } from '../../src/budget/snapshot-publisher';
import { createSnapshotStore } from '../../src/budget/snapshot-store';
import { createAccountData } from '../../src/data/accounts';
import { createAsyncAtomicRunner } from '../../src/data/atomic';
import { createCategoryData } from '../../src/data/categories';
import { createCommitmentData } from '../../src/data/commitments';
import { createLedgerChangeNotifier } from '../../src/data/ledger-change-notifier';
import { createManualTransactionData } from '../../src/data/manual-transactions';
import { createMonthConfigData } from '../../src/data/month-config';
import { createPeriodPreparationData } from '../../src/data/period-preparation';
import { createShareData } from '../../src/data/shares';
import { createTransactionData } from '../../src/data/transactions';
import { createProxyDatabase, openMigratedDatabase } from './sqlite-proxy';

export const completionNow = new Date(2026, 8, 15, 12, 30);
export const completionPhotoKey = 'photos/v1/123e4567-e89b-42d3-a456-426614174001.jpg';
export const spendLeafId = '20000000-0000-4000-8000-000000000001';
export const reserveLeafId = '20000000-0000-4000-8000-000000000007';

export type DraftCompletionHarness = {
  database: DatabaseSync;
  proxy: ReturnType<typeof createProxyDatabase>;
  notifier: ReturnType<typeof createLedgerChangeNotifier>;
  changes: string[];
  transactions: ReturnType<typeof createTransactionData<'async'>>;
  manual: ReturnType<typeof createManualTransactionData<'async'>>;
  commitments: ReturnType<typeof createCommitmentData<'async'>>;
  monthConfigs: ReturnType<typeof createMonthConfigData<'async'>>;
  preparation: ReturnType<typeof createPeriodPreparationData<'async'>>;
  publisher: SnapshotPublisher;
  written: BudgetSnapshot[];
  setWriteFailure(value: boolean): void;
};

export function idFor(
  database: ReturnType<typeof openMigratedDatabase>,
  query: string,
  ...params: string[]
): string {
  const row = database.prepare(query).get(...params) as { id: string } | undefined;
  if (row === undefined) throw new Error(`Missing id for ${query}`);
  return row.id;
}

export function bankId(database: ReturnType<typeof openMigratedDatabase>): string {
  return idFor(database, "SELECT id FROM accounts WHERE name = 'Bank' AND deleted_at IS NULL");
}

export function spendLeaf(database: ReturnType<typeof openMigratedDatabase>): string {
  return idFor(database, 'SELECT id FROM categories WHERE id = ?', spendLeafId);
}

export function reserveLeaf(database: ReturnType<typeof openMigratedDatabase>): string {
  return idFor(database, 'SELECT id FROM categories WHERE id = ?', reserveLeafId);
}

export function countRows(
  database: ReturnType<typeof openMigratedDatabase>,
  table: 'month_config' | 'transactions'
): number {
  return (database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;
}

export function monthConfigRow(
  database: ReturnType<typeof openMigratedDatabase>,
  period: string
): Record<string, unknown> | undefined {
  return database.prepare(
    `SELECT period, opening_balance AS openingBalance, income_total AS incomeTotal,
      reserved_total AS reservedTotal, horizon_date AS horizonDate
     FROM month_config WHERE period = ? AND deleted_at IS NULL`
  ).get(period) as Record<string, unknown> | undefined;
}

export function financialSnapshot(snapshot: BudgetSnapshot): Omit<BudgetSnapshot, 'updatedAt'> {
  const { updatedAt: _updatedAt, ...financial } = snapshot;
  return financial;
}

export async function waitFor(condition: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (condition()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error(message);
}

export function readySnapshot(publisher: SnapshotPublisher): BudgetSnapshot {
  const state = publisher.store.getState();
  if (state.status !== 'ready') {
    throw new Error(`Expected ready snapshot, received ${state.status}`);
  }
  return state.snapshot;
}

export function createDraftCompletionHarness(database: DatabaseSync): DraftCompletionHarness {
  const proxy = createProxyDatabase(database);
  const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
  const changes: string[] = [];
  notifier.subscribe(({ table, mutation }) => changes.push(`${table}:${mutation}`));
  const silentNotifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
  const categories = createCategoryData(proxy, silentNotifier);
  const transactions = createTransactionData(proxy, categories, silentNotifier);
  const runAtomic = createAsyncAtomicRunner(proxy);
  const preparation = createPeriodPreparationData(proxy, {
    now: () => completionNow,
    runAtomic,
    changeNotifier: silentNotifier,
  });
  const monthConfigs = createMonthConfigData(proxy, silentNotifier);
  const manual = createManualTransactionData(proxy, categories, notifier, {
    now: () => completionNow,
    runAtomic,
  });
  const reads = {
    accounts: createAccountData(proxy, silentNotifier),
    commitments: createCommitmentData(proxy, silentNotifier),
    monthConfig: monthConfigs,
    shares: createShareData(proxy),
    transactions,
  };
  const written: BudgetSnapshot[] = [];
  let failWrite = false;
  const publisher = createSnapshotPublisher({
    store: createSnapshotStore(),
    now: () => completionNow,
    readInput: async (at) => {
      await preparation.prepareCurrentPeriod(at);
      return readBudgetInput(reads, at);
    },
    writer(snapshot) {
      if (failWrite) throw new Error('shared storage unavailable');
      written.push(snapshot);
    },
  });

  return {
    database,
    proxy,
    notifier,
    changes,
    transactions,
    manual,
    commitments: createCommitmentData(proxy, notifier),
    monthConfigs,
    preparation,
    publisher,
    written,
    setWriteFailure(value) {
      failWrite = value;
    },
  };
}
