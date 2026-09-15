/**
 * Records transfers as one atomic ledger mutation.
 *
 * A transfer changes two projected account balances but never creates a
 * transaction row. The projection is reread before commit so an unsafe
 * resulting balance rolls the insert back with the rest of the mutation.
 */
import { and, inArray } from 'drizzle-orm';

import {
  createDefaultAtomicRunner,
  type LedgerDatabase,
} from './atomic';
import {
  recordTransferSchema,
  type RecordTransfer,
} from './account-validation';
import type { AccountDataOptions } from './account-data-options';
import { readAccountBalances } from './account-projection';
import { assertManualOccurredAt } from './manual-transaction-policy';
import {
  ledgerChangeNotifier,
  type LedgerChangeNotifier,
} from './ledger-change-notifier';
import { activeRowFilter } from './soft-delete';
import { accounts, transfers } from './schema';

function accountNotFound(accountId: string): Error {
  return new Error(`Active account ${accountId} was not found`);
}

async function requireActiveAccounts<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  accountIds: readonly [string, string]
): Promise<void> {
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        activeRowFilter(accounts.deletedAt),
        inArray(accounts.id, accountIds)
      )
    )
    .all();
  const found = new Set(rows.map((row) => row.id));
  for (const accountId of accountIds) {
    if (!found.has(accountId)) {
      throw accountNotFound(accountId);
    }
  }
}

async function recordTransferInTransaction<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  input: RecordTransfer
): Promise<void> {
  await requireActiveAccounts(db, [input.fromAccountId, input.toAccountId]);
  await db.insert(transfers).values(input).run();
  await readAccountBalances(db);
}

export function createTransferData<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  changeNotifier: LedgerChangeNotifier = ledgerChangeNotifier,
  options: AccountDataOptions<TResultKind> = {}
) {
  const runAtomic = options.runAtomic ?? createDefaultAtomicRunner(db);
  const now = options.now ?? (() => new Date());

  return {
    async recordTransfer(input: unknown): Promise<void> {
      const parsed = recordTransferSchema.parse(input);
      const submittedAt = now();
      assertManualOccurredAt(parsed.occurredAt, submittedAt);
      await runAtomic((transactionDb) =>
        recordTransferInTransaction(transactionDb, parsed)
      );
      changeNotifier.notify({ table: 'transfers', mutation: 'created' });
    },
  };
}
