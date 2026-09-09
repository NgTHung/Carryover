/**
 * Connects native routes to the ledger after the root migration gate.
 *
 * Route discovery bundles fallback files on web, so native database imports
 * need a platform boundary outside src/app.
 */
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

import {
  accountData,
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
import type { TransactionEditorData } from './transactions/transaction-editor-contract';

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

const transactionEditorData: TransactionEditorData = {
  readTransaction: (id) => transactionData.readTransaction(id),
  listActiveCategoryGroups: () => categoryData.listActiveCategoryGroups(),
  listActiveAccounts: () => accountData.listActiveAccounts(),
  editTransaction: (input) => transactionData.editTransaction(input),
  completeDraft: (input) => transactionData.completeDraft(input),
  softDeleteTransaction: (id) => transactionData.softDeleteTransaction(id),
};

export function getTransactionEditorData(): TransactionEditorData {
  return transactionEditorData;
}

export type { LedgerChange };
