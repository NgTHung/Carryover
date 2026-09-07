/**
 * Account and transfer persistence for the ledger.
 *
 * Account balances are read-time projections of active ledger rows. This keeps
 * an edit or out-of-order transfer from leaving a stored running total stale.
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import {
  deriveAccountBalances,
  type BalanceTransaction,
  type BalanceTransfer,
} from './account-balances';
import {
  recordTransferSchema,
  updateAccountOpeningBalanceSchema,
} from './account-validation';
import { activeRowFilter } from './soft-delete';
import {
  accounts,
  ledgerTables,
  transactions,
  transfers,
} from './schema';

type LedgerDatabase<TResultKind extends 'sync' | 'async'> = BaseSQLiteDatabase<
  TResultKind,
  unknown,
  typeof ledgerTables
>;

export type AccountBalance = {
  accountId: string;
  name: string;
  kind: 'bank' | 'cash';
  isDefault: boolean;
  openingBalance: number;
  balance: number;
};

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
  db: LedgerDatabase<TResultKind>
) {
  return {
    async updateOpeningBalance(input: unknown): Promise<void> {
      const parsed = updateAccountOpeningBalanceSchema.parse(input);
      const existing = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.id, parsed.accountId),
            activeRowFilter(accounts.deletedAt)
          )
        )
        .get();
      if (!existing) {
        throw accountNotFound(parsed.accountId);
      }

      await db
        .update(accounts)
        .set({
          openingBalance: parsed.openingBalance,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(accounts.id, parsed.accountId),
            activeRowFilter(accounts.deletedAt)
          )
        )
        .run();
    },

    async recordTransfer(input: unknown): Promise<void> {
      const parsed = recordTransferSchema.parse(input);
      await requireActiveAccounts(db, [parsed.fromAccountId, parsed.toAccountId]);
      await db.insert(transfers).values(parsed).run();
    },

    async readAccountBalances(): Promise<AccountBalance[]> {
      const accountRows = await db
        .select({
          accountId: accounts.id,
          name: accounts.name,
          kind: accounts.kind,
          isDefault: accounts.isDefault,
          openingBalance: accounts.openingBalance,
        })
        .from(accounts)
        .where(activeRowFilter(accounts.deletedAt))
        .all();
      const accountIds = new Set(accountRows.map((account) => account.accountId));

      const transactionRows = await db
        .select({
          accountId: transactions.accountId,
          direction: transactions.direction,
          amount: transactions.amount,
        })
        .from(transactions)
        .where(activeRowFilter(transactions.deletedAt))
        .all();
      const balanceTransactions: BalanceTransaction[] = transactionRows.filter(
        (transaction) => accountIds.has(transaction.accountId)
      );

      const transferRows = await db
        .select({
          fromAccountId: transfers.fromAccountId,
          toAccountId: transfers.toAccountId,
          amount: transfers.amount,
        })
        .from(transfers)
        .where(activeRowFilter(transfers.deletedAt))
        .all();
      const balanceTransfers: BalanceTransfer[] = transferRows.filter(
        (transfer) =>
          accountIds.has(transfer.fromAccountId) && accountIds.has(transfer.toAccountId)
      );

      const derived = deriveAccountBalances({
        accounts: accountRows,
        transactions: balanceTransactions,
        transfers: balanceTransfers,
      });
      const balanceById = new Map(
        derived.map((account) => [account.accountId, account.balance])
      );

      return accountRows.map((account) => {
        const balance = balanceById.get(account.accountId);
        if (balance === undefined) {
          throw new Error(`Could not derive account ${account.accountId}`);
        }
        return { ...account, balance };
      });
    },
  };
}

export type AccountData<TResultKind extends 'sync' | 'async'> = ReturnType<
  typeof createAccountData<TResultKind>
>;
