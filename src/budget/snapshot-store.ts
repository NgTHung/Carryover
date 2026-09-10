/**
 * Holds the exact snapshot last published by the budget coordinator.
 *
 * SQLite and shared storage remain the sources of truth. The store only makes
 * the publication state observable to React, so it cannot invent a budget
 * figure while a refresh is loading or has failed.
 */
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

import type { BudgetSnapshot } from './snapshot';

export type SnapshotState =
  | { status: 'loading' }
  | { status: 'ready'; snapshot: BudgetSnapshot }
  | { status: 'error'; error: Error };

export type SnapshotStore = StoreApi<SnapshotState>;

export function createSnapshotStore(): SnapshotStore {
  return createStore<SnapshotState>(() => ({ status: 'loading' }));
}

/** The app-wide store used by screens after the coordinator is mounted. */
export const snapshotStore = createSnapshotStore();

/** Subscribe a component to a selected part of the publication state. */
export function useSnapshotStore<Selected>(
  selector: (state: SnapshotState) => Selected
): Selected {
  return useStore(snapshotStore, selector);
}

export function setSnapshotLoading(store: SnapshotStore): void {
  store.setState({ status: 'loading' }, true);
}

export function setSnapshotReady(
  store: SnapshotStore,
  snapshot: BudgetSnapshot
): void {
  store.setState({ status: 'ready', snapshot }, true);
}

export function setSnapshotError(store: SnapshotStore, error: unknown): void {
  store.setState({
    status: 'error',
    error: error instanceof Error ? error : new Error(String(error)),
  }, true);
}
