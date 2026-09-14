/**
 * Shared transaction-runner types for data boundaries.
 *
 * The test database uses Drizzle's asynchronous proxy, while Expo's native
 * connection is synchronous inside an exclusive transaction. Keeping the
 * runner injectable lets both use the same mutation logic without pretending a
 * synchronous transaction can await an asynchronous callback.
 */
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { ledgerTables } from './schema';

export type LedgerDatabase<TResultKind extends 'sync' | 'async'> =
  BaseSQLiteDatabase<TResultKind, unknown, typeof ledgerTables>;

export type AtomicTransactionRunner<
  TResultKind extends 'sync' | 'async',
> = <T>(
  operation: (transactionDb: LedgerDatabase<TResultKind>) => Promise<T>
) => Promise<T>;

/**
 * This runner is for the asynchronous SQLite proxy used by database tests.
 * Calls are serialized because a proxy and its in-memory SQLite connection
 * cannot have two top-level BEGIN statements open at the same time.
 */
export function createAsyncAtomicRunner(
  db: LedgerDatabase<'async'>
): AtomicTransactionRunner<'async'> {
  let queue: Promise<void> = Promise.resolve();

  return <T>(operation: (transactionDb: LedgerDatabase<'async'>) => Promise<T>) => {
    const run = queue.then(async () => db.transaction((transactionDb) => operation(transactionDb)));
    queue = run.then(() => undefined, () => undefined);
    return run;
  };
}

export function createDefaultAtomicRunner<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>
): AtomicTransactionRunner<TResultKind> {
  let queue: Promise<void> = Promise.resolve();

  return <T>(operation: (transactionDb: LedgerDatabase<TResultKind>) => Promise<T>) => {
    const run = queue.then(async () => {
      const result = db.transaction((transactionDb) => operation(transactionDb));
      return await (result as unknown as Promise<T>);
    });
    queue = run.then(() => undefined, () => undefined);
    return run;
  };
}
