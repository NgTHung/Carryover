/**
 * Account and transfer persistence for the ledger.
 *
 * Account balances are read-time projections of ledger rows. Deleted accounts
 * remain in the projection so their past transfers still affect active accounts.
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { createAccountEdits, type AccountEditOptions } from './account-edits';
import {
  readAccountBalances,
  type AccountBalance,
} from './account-projection';
import {
  recordTransferSchema,
} from './account-validation';
import {
  reconcileAccount,
  type ReconcileResult,
} from './account-reconcile';
import {
  ledgerChangeNotifier,
  type LedgerChangeNotifier,
} from './ledger-change-notifier';
import { activeRowFilter } from './soft-delete';
import { accounts, ledgerTables, transfers } from './schema';

export type { ReconcileResult } from './account-reconcile';

type LedgerDatabase<TResultKind extends 'sync' | 'async'> = BaseSQLiteDatabase<
  TResultKind,
  unknown,
  typeof ledgerTables
>;

export type { AccountBalance } from './account-projection';

export type ActiveAccount = Omit<AccountBalance, 'openingBalance' | 'balance'>;

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

export function createAccountData<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  changeNotifier: LedgerChangeNotifier = ledgerChangeNotifier,
  options: AccountEditOptions<TResultKind> = {}
) {
  const accountEdits = createAccountEdits(db, changeNotifier, options);

  return {
    ...accountEdits,

    async recordTransfer(input: unknown): Promise<void> {
      const parsed = recordTransferSchema.parse(input);
      await requireActiveAccounts(db, [parsed.fromAccountId, parsed.toAccountId]);
      await db.insert(transfers).values(parsed).run();
      changeNotifier.notify({ table: 'transfers', mutation: 'created' });
    },

    async listActiveAccounts(): Promise<ActiveAccount[]> {
      return db
        .select({
          accountId: accounts.id,
          name: accounts.name,
          kind: accounts.kind,
          isDefault: accounts.isDefault,
        })
        .from(accounts)
        .where(activeRowFilter(accounts.deletedAt))
        .all();
    },

    readAccountBalances: () => readAccountBalances(db),

    async reconcileAccount(input: unknown): Promise<ReconcileResult> {
      return reconcileAccount(
        db,
        changeNotifier,
        input
      );
    },
  };
}

export type AccountData<TResultKind extends 'sync' | 'async'> = ReturnType<
  typeof createAccountData<TResultKind>
>;
