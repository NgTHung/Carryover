/**
 * Connects native routes to the ledger after the root migration gate.
 *
 * Route discovery bundles fallback files on web, so native database imports
 * need a platform boundary outside src/app.
 */
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { AppState } from 'react-native';

import { startSnapshotFreshness } from '../budget/snapshot-freshness';
import {
  createSnapshotPublisher,
  startSnapshotPublisher,
} from '../budget/snapshot-publisher';
import { writeSharedSnapshot } from '../budget/snapshot-writer';
import {
  accountData,
  categoryData,
  commitmentData,
  ledgerChangeNotifier,
  ledgerDb,
  ledgerMigrations,
  manualTransactionData,
  monthConfigData,
  readCommittedMonthSummary,
  readCommittedBudgetInput,
  reservePaymentData,
  transactionData,
  transactionListData,
} from '../data/database';
import type { CategoryEditorData } from './categories/category-editor-contract';
import type { CommitmentManagerData } from './commitments/commitment-manager-contract';
import type { AccountEditorData } from './accounts/account-editor-contract';
import type {
  LedgerChange,
  LedgerChangeListener,
} from '../data/ledger-change-notifier';
import type { TransactionListData } from '../data/transaction-list';
import type { TransactionCreateData } from './transactions/transaction-create-contract';
import type { TransactionEditorData } from './transactions/transaction-editor-contract';
import type { TransferCreationData } from './transfers/transfer-data-contract';
import type { HorizonEditorData } from './horizon/horizon-editor-contract';

export function useLedgerMigrations() {
  return useMigrations(ledgerDb, ledgerMigrations);
}

export function getCategoryEditorData(): CategoryEditorData {
  return categoryData;
}

export function getAccountEditorData(): AccountEditorData {
  return accountData;
}

export function getAccountReconcileData(): AccountEditorData {
  return getAccountEditorData();
}

const transferCreationData: TransferCreationData = {
  listActiveAccounts: () => accountData.listActiveAccounts(),
  recordTransfer: (input) => accountData.recordTransfer(input),
};

export function getTransferCreationData(): TransferCreationData {
  return transferCreationData;
}

const commitmentManagerData: CommitmentManagerData = {
  readCommitmentOverview: (period) =>
    commitmentData.readCommitmentOverview(period),
  listActiveCategoryGroups: () => categoryData.listActiveCategoryGroups(),
  createCommitment: (input) => commitmentData.createCommitment(input),
  editCommitment: (input) => commitmentData.editCommitment(input),
  softDeleteCommitment: (id) => commitmentData.softDeleteCommitment(id),
};

export function getCommitmentManagerData(): CommitmentManagerData {
  return commitmentManagerData;
}

export function getHorizonEditorData(): HorizonEditorData {
  return monthConfigData;
}

export function readTransaction(id: string) {
  return transactionData.readTransaction(id);
}

export function getTransactionListData(): TransactionListData<'sync'> {
  return transactionListData;
}

const monthSummaryData = { readMonthSummary: readCommittedMonthSummary };

export function getMonthSummaryData() {
  return monthSummaryData;
}

export function subscribeLedgerChanges(listener: LedgerChangeListener): () => void {
  return ledgerChangeNotifier.subscribe(listener);
}

const budgetSnapshotPublisher = createSnapshotPublisher({
  readInput: readCommittedBudgetInput,
  writer: writeSharedSnapshot,
});

export function startBudgetSnapshotPublication(): () => void {
  const stopPublication = startSnapshotPublisher(
    budgetSnapshotPublisher,
    ledgerChangeNotifier
  );
  const stopFreshness = startSnapshotFreshness(
    budgetSnapshotPublisher,
    AppState
  );
  return () => {
    stopFreshness();
    stopPublication();
  };
}

export function refreshBudgetSnapshot(): Promise<void> {
  return budgetSnapshotPublisher.refresh();
}

export function retryBudgetSnapshot(): Promise<void> {
  return budgetSnapshotPublisher.retry();
}

const transactionEditorData: TransactionEditorData = {
  readTransaction: (id) => transactionData.readTransaction(id),
  listActiveCategoryGroups: () => categoryData.listActiveCategoryGroups(),
  listActiveAccounts: () => accountData.listActiveAccounts(),
  editTransaction: (input) => manualTransactionData.editTransaction(input),
  completeDraft: (input) => manualTransactionData.completeDraft(input),
  softDeleteTransaction: (id) => manualTransactionData.softDeleteTransaction(id),
};

const transactionCreateData: TransactionCreateData = {
  listActiveCategoryGroups: () => categoryData.listActiveCategoryGroups(),
  listActiveAccounts: () => accountData.listActiveAccounts(),
  readCommitmentOverview: (period) =>
    commitmentData.readCommitmentOverview(period),
  createCompleteTransaction: (input) => manualTransactionData.createTransaction(input),
  createReservePayment: (input) => reservePaymentData.createReservePayment(input),
};

export function getTransactionEditorData(): TransactionEditorData {
  return transactionEditorData;
}

export function getTransactionCreateData(): TransactionCreateData {
  return transactionCreateData;
}

export type { LedgerChange };
