/**
 * Publishes committed ledger changes to mounted app surfaces.
 *
 * SQLite remains the source of truth. The notifier carries only invalidation
 * metadata, so a subscriber must reread its own public data API after a commit.
 */
export type LedgerChangeTable =
  | 'transactions'
  | 'transfers'
  | 'categories'
  | 'accounts';

export type LedgerChangeMutation =
  | 'created'
  | 'edited'
  | 'completed'
  | 'deleted'
  | 'updated';

export type LedgerChange = {
  table: LedgerChangeTable;
  mutation: LedgerChangeMutation;
};

export type LedgerChangeListener = (change: LedgerChange) => void;
export type LedgerChangeListenerError = (
  error: unknown,
  change: LedgerChange
) => void;

export type LedgerChangeNotifier = {
  subscribe(listener: LedgerChangeListener): () => void;
  notify(change: LedgerChange): void;
};

export function createLedgerChangeNotifier(options: {
  onListenerError?: LedgerChangeListenerError;
} = {}): LedgerChangeNotifier {
  const listeners = new Set<LedgerChangeListener>();
  const onListenerError =
    options.onListenerError ??
    ((error: unknown, change: LedgerChange) => {
      console.error(
        `Ledger change listener failed for ${change.table}:${change.mutation}`,
        error
      );
    });

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify(change) {
      for (const listener of listeners) {
        try {
          listener(change);
        } catch (error: unknown) {
          // A view listener must not turn an already committed write into an error.
          try {
            onListenerError(error, change);
          } catch (reportingError: unknown) {
            console.error('Ledger change listener error reporting failed', reportingError);
          }
        }
      }
    },
  };
}

export const ledgerChangeNotifier = createLedgerChangeNotifier();
