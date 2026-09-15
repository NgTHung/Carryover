/**
 * Account and transfer persistence for the ledger.
 *
 * Account balances are read-time projections of ledger rows. Deleted accounts
 * remain in the projection so their past transfers still affect active accounts.
 */
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { createAccountEdits } from './account-edits';
import type { AccountDataOptions } from './account-data-options';
import {
  readAccountBalances,
  type AccountBalance,
} from './account-projection';
import {
  reconcileAccount,
  type ReconcileResult,
} from './account-reconcile';
import {
  ledgerChangeNotifier,
  type LedgerChangeNotifier,
} from './ledger-change-notifier';
import { activeRowFilter } from './soft-delete';
import { accounts, ledgerTables } from './schema';
import { createTransferData } from './transfers';

export type { ReconcileResult } from './account-reconcile';

type LedgerDatabase<TResultKind extends 'sync' | 'async'> = BaseSQLiteDatabase<
  TResultKind,
  unknown,
  typeof ledgerTables
>;

export type { AccountBalance } from './account-projection';

export type ActiveAccount = Omit<AccountBalance, 'openingBalance' | 'balance'>;

export function createAccountData<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  changeNotifier: LedgerChangeNotifier = ledgerChangeNotifier,
  options: AccountDataOptions<TResultKind> = {}
) {
  const accountEdits = createAccountEdits(db, changeNotifier, options);
  const transferData = createTransferData(db, changeNotifier, options);

  return {
    ...accountEdits,

    ...transferData,

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
