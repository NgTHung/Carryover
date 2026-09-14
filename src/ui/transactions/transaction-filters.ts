/**
 * Shared transaction-list controls for screens that survive navigation.
 *
 * The store keeps only filter choices. Rows remain in SQLite, which prevents a
 * stale in-memory collection from becoming a second ledger.
 */
import { create } from 'zustand';

import { dateOnlyFromLocalDate } from '../../data/date-only';
import { currentPeriod, periodSchema, type Period } from '../../data/period';
import type { TransactionQuality } from '../../data/transaction-validation';

export type TransactionQualityFilter = TransactionQuality | 'unrated' | null;

export type TransactionFilterState = {
  selectedPeriod: Period;
  categoryId: string | null;
  accountId: string | null;
  quality: TransactionQualityFilter;
};

export type TransactionFilterActions = {
  setSelectedPeriod(period: Period): void;
  setCategoryId(categoryId: string | null): void;
  setAccountId(accountId: string | null): void;
  setQuality(quality: TransactionQualityFilter): void;
  revealTransaction(occurredAt: Date): void;
  reset(): void;
};

export type TransactionFilterStore = TransactionFilterState & TransactionFilterActions;

function initialState(period: Period): TransactionFilterState {
  return {
    selectedPeriod: periodSchema.parse(period),
    categoryId: null,
    accountId: null,
    quality: null,
  };
}

function periodForTransaction(occurredAt: Date): Period {
  return periodSchema.parse(dateOnlyFromLocalDate(occurredAt).slice(0, 7));
}

export function createTransactionFilterStore(
  initialPeriod: Period = currentPeriod()
) {
  return create<TransactionFilterStore>((set) => ({
    ...initialState(initialPeriod),
    setSelectedPeriod: (selectedPeriod) => set({ selectedPeriod: periodSchema.parse(selectedPeriod) }),
    setCategoryId: (categoryId) => set({ categoryId }),
    setAccountId: (accountId) => set({ accountId }),
    setQuality: (quality) => set({ quality }),
    revealTransaction: (occurredAt) => set({
      selectedPeriod: periodForTransaction(occurredAt),
      categoryId: null,
      accountId: null,
      quality: null,
    }),
    reset: () => set(initialState(currentPeriod())),
  }));
}

export const useTransactionFilters = createTransactionFilterStore();
