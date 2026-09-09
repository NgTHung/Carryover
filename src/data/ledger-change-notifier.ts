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

export type LedgerChangeNotifier = {
  subscribe(listener: LedgerChangeListener): () => void;
  notify(change: LedgerChange): void;
};

export function createLedgerChangeNotifier(): LedgerChangeNotifier {
  const listeners = new Set<LedgerChangeListener>();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify(change) {
      for (const listener of listeners) {
        try {
          listener(change);
        } catch {
          // A view listener must not turn an already committed write into an error.
        }
      }
    },
  };
}

export const ledgerChangeNotifier = createLedgerChangeNotifier();
