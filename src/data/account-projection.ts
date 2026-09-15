/**
 * Reads account balances from the ledger projection.
 *
 * Accounts do not store running totals. Keeping this read in one module lets
 * account edits validate their committed projection before the transaction
 * can change the opening balance.
 */
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import {
  deriveAccountBalances,
  type BalanceTransaction,
} from './account-balances';
import { ledgerTables, accounts, transactions, transfers } from './schema';
import { activeRowFilter } from './soft-delete';

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

export async function readAccountBalances<
  TResultKind extends 'sync' | 'async',
>(db: LedgerDatabase<TResultKind>): Promise<AccountBalance[]> {
  const allAccountRows = await db
    .select({
      accountId: accounts.id,
      name: accounts.name,
      kind: accounts.kind,
      isDefault: accounts.isDefault,
      openingBalance: accounts.openingBalance,
      deletedAt: accounts.deletedAt,
    })
    .from(accounts)
    .all();
  const activeAccountRows = allAccountRows.filter(
    (account) => account.deletedAt === null
  );

  const transactionRows = await db
    .select({
      accountId: transactions.accountId,
      direction: transactions.direction,
      amount: transactions.amount,
      adjustmentEffect: transactions.adjustmentEffect,
      payerContactId: transactions.payerContactId,
    })
    .from(transactions)
    .where(activeRowFilter(transactions.deletedAt))
    .all();
  const balanceTransactions: BalanceTransaction[] = transactionRows.map(
    (transaction) => {
      const base = {
        accountId: transaction.accountId,
        amount: transaction.amount,
      };
      return transaction.direction === 'expense'
        ? {
            ...base,
            direction: transaction.direction,
            payerContactId: transaction.payerContactId,
          }
        : transaction.direction === 'adjustment'
          ? {
              ...base,
              direction: transaction.direction,
              adjustmentEffect: transaction.adjustmentEffect,
            }
          : { ...base, direction: transaction.direction };
    }
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
  const derived = deriveAccountBalances({
    accounts: allAccountRows,
    transactions: balanceTransactions,
    transfers: transferRows,
  });
  const balanceById = new Map(
    derived.map((account) => [account.accountId, account.balance])
  );

  return activeAccountRows.map(({ deletedAt: _deletedAt, ...account }) => {
    const balance = balanceById.get(account.accountId);
    if (balance === undefined) {
      throw new Error(`Could not derive account ${account.accountId}`);
    }
    return { ...account, balance };
  });
}
