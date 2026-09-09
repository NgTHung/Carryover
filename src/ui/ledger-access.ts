/**
 * Connects native routes to the ledger after the root migration gate.
 *
 * Route discovery bundles fallback files on web, so native database imports
 * need a platform boundary outside src/app.
 */
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

import {
  categoryData,
  ledgerChangeNotifier,
  ledgerDb,
  ledgerMigrations,
  transactionData,
  transactionListData,
} from '../data/database';
import type { CategoryEditorData } from './categories/category-editor-contract';
import type {
  LedgerChange,
  LedgerChangeListener,
} from '../data/ledger-change-notifier';
import type { TransactionListData } from '../data/transaction-list';

export function useLedgerMigrations() {
  return useMigrations(ledgerDb, ledgerMigrations);
}

export function getCategoryEditorData(): CategoryEditorData {
  return categoryData;
}

export function readTransaction(id: string) {
  return transactionData.readTransaction(id);
}

export function getTransactionListData(): TransactionListData<'sync'> {
  return transactionListData;
}

export function subscribeLedgerChanges(listener: LedgerChangeListener): () => void {
  return ledgerChangeNotifier.subscribe(listener);
}

export type { LedgerChange };
