/**
 * Coordinates one budget publication from committed ledger data.
 *
 * The coordinator owns publication ordering and failure state. Budget
 * arithmetic stays in `computeBudget`; the reader supplies normalized facts
 * and the writer owns the shared-storage edge.
 */
import { computeBudget, type BudgetInput } from './compute-budget';
import type { BudgetSnapshot } from './snapshot';
import {
  setSnapshotError,
  setSnapshotLoading,
  setSnapshotReady,
  snapshotStore,
  type SnapshotStore,
} from './snapshot-store';

type Awaitable<T> = T | Promise<T>;

export type SnapshotInputReader = (
  now: Date
) => Awaitable<Omit<BudgetInput, 'updatedAt'>>;

export type SnapshotWriter = (snapshot: BudgetSnapshot) => Awaitable<void>;

export type SnapshotComputer = (input: BudgetInput) => BudgetSnapshot;

export type SnapshotPublisherOptions = {
  readInput: SnapshotInputReader;
  writer: SnapshotWriter;
  compute?: SnapshotComputer;
  store?: SnapshotStore;
  now?: () => Date;
};

export type SnapshotPublisher = {
  store: SnapshotStore;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
};

export type SnapshotRefreshNotifier = {
  subscribe(listener: () => void): () => void;
};

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Build a publisher with injectable edges for database, clock, storage, and
 * tests. Refresh requests run in order. Every request writes its result, while
 * only the newest request may publish ready or error state.
 */
export function createSnapshotPublisher(
  options: SnapshotPublisherOptions
): SnapshotPublisher {
  const store = options.store ?? snapshotStore;
  const compute = options.compute ?? computeBudget;
  const now = options.now ?? (() => new Date());
  let requestNumber = 0;
  let queue: Promise<void> = Promise.resolve();

  const refresh = (): Promise<void> => {
    const request = ++requestNumber;
    setSnapshotLoading(store);

    const run = queue.then(async () => {
      try {
        const input = await options.readInput(now());
        const updatedAt = now().toISOString();
        const snapshot = compute({ ...input, updatedAt });
        await options.writer(snapshot);
        if (request !== requestNumber) {
          // The write is required for every queued mutation, but an older
          // result must not make a newer refresh look complete.
          return;
        }

        // Keep the exact object given to the writer so the app and shared
        // storage have one observable artifact.
        setSnapshotReady(store, snapshot);
      } catch (error: unknown) {
        const failure = asError(error);
        if (request === requestNumber) {
          setSnapshotError(store, failure);
          throw failure;
        }
      }
    });

    // A failed request must not prevent a later retry or mutation refresh.
    queue = run.catch(() => undefined);
    return run;
  };

  return { store, refresh, retry: refresh };
}

/** Start one fresh publication and refresh after each committed ledger change. */
export function startSnapshotPublisher(
  publisher: SnapshotPublisher,
  notifier: SnapshotRefreshNotifier
): () => void {
  const refresh = () => {
    void publisher.refresh().catch(() => {
      // The publisher has already replaced any stale snapshot with error state.
    });
  };
  const unsubscribe = notifier.subscribe(refresh);
  refresh();
  return unsubscribe;
}
