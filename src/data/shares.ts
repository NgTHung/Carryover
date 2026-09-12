/**
 * Read-only access to split share rows.
 *
 * SPLIT-001 owns writing contacts and shares. Reports and the budget snapshot
 * still need one soft-delete-aware read now, so they cannot drift when those
 * rows become available.
 */
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { activeRowFilter, type SoftDeleteOptions } from './soft-delete';
import { ledgerTables, splits } from './schema';

type LedgerDatabase<TResultKind extends 'sync' | 'async'> = BaseSQLiteDatabase<
  TResultKind,
  unknown,
  typeof ledgerTables
>;

export type LedgerShare = {
  transactionId: string;
  contactId: string | null;
  shareAmount: number;
};

export function createShareData<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>
) {
  return {
    async readShares(options: SoftDeleteOptions = {}): Promise<LedgerShare[]> {
      return db
        .select({
          transactionId: splits.transactionId,
          contactId: splits.contactId,
          shareAmount: splits.shareAmount,
        })
        .from(splits)
        .where(activeRowFilter(splits.deletedAt, options))
        .all();
    },
  };
}

export type ShareData<TResultKind extends 'sync' | 'async'> = ReturnType<
  typeof createShareData<TResultKind>
>;
