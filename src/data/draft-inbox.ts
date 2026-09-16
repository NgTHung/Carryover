/**
 * Reads the active draft inbox without applying transaction-list filters.
 *
 * Drafts stay reachable across periods even when their account, category, or
 * retained photo is no longer available, so this boundary selects one table
 * and leaves labels and files to the surfaces that need them.
 */
import { and, asc, eq, sql } from 'drizzle-orm';

import type { LedgerDatabase } from './atomic';
import { activeRowFilter } from './soft-delete';
import { transactions } from './schema';
import { toTransaction } from './transactions';
import type { DraftTransaction } from './transaction-validation';

function decodeDraft(row: typeof transactions.$inferSelect): DraftTransaction {
  try {
    const transaction = toTransaction(row);
    if (transaction.status !== 'draft') {
      throw new Error(`decoded status was ${transaction.status}`);
    }
    return transaction;
  } catch (error: unknown) {
    throw new Error(`Draft inbox row ${row.id} could not be decoded`, {
      cause: error,
    });
  }
}

export function createDraftInboxData<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>
) {
  return {
    async readActiveDrafts(): Promise<DraftTransaction[]> {
      const rows = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.status, 'draft'),
            activeRowFilter(transactions.deletedAt)
          ) ?? sql`1`
        )
        .$dynamic()
        .orderBy(asc(transactions.createdAt), asc(transactions.id));

      return rows.map(decodeDraft);
    },
  };
}

export type DraftInboxData<TResultKind extends 'sync' | 'async'> = ReturnType<
  typeof createDraftInboxData<TResultKind>
>;
