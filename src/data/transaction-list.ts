/**
 * Read model for the transaction list.
 *
 * The ledger has two visible transfer representations, the legacy transaction
 * direction and the dedicated transfers table. Both are returned as explicit
 * read-only rows so the list never treats a transfer as spending.
 */
import {
  and,
  eq,
  gte,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

import { categoryIdSchema } from './category-validation';
import {
  ledgerChangeNotifier,
  type LedgerChangeNotifier,
} from './ledger-change-notifier';
import { periodBounds, periodSchema, type Period } from './period';
import { activeRowFilter } from './soft-delete';
import {
  accounts,
  ledgerTables,
  transactions,
  transfers,
} from './schema';
import { toTransaction } from './transactions';
import {
  transactionQualitySchema,
  type Transaction,
  type TransactionQuality,
} from './transaction-validation';

type LedgerDatabase<TResultKind extends 'sync' | 'async'> = BaseSQLiteDatabase<
  TResultKind,
  unknown,
  typeof ledgerTables
>;

export type TransactionQualityFilter = TransactionQuality | 'unrated' | null;

export type TransactionListFilters = {
  period: Period;
  categoryId: string | null;
  accountId: string | null;
  quality: TransactionQualityFilter;
};

export const transactionListFiltersSchema = z
  .object({
    period: periodSchema,
    categoryId: categoryIdSchema.nullable(),
    accountId: categoryIdSchema.nullable(),
    quality: z
      .union([transactionQualitySchema, z.literal('unrated')])
      .nullable(),
  })
  .strict();

export type AccountLabel = {
  id: string;
  name: string;
  kind: 'bank' | 'cash';
};

export type CategoryLabel = {
  id: string;
  name: string;
  group: { id: string; name: string };
};

export type TransactionListTransactionRow = {
  kind: 'transaction';
  transaction: Transaction;
  account: AccountLabel;
  category: CategoryLabel | null;
};

export type TransactionListTransactionTransferRow = {
  kind: 'transfer';
  source: 'transaction';
  transaction: Transaction;
  account: AccountLabel;
};

export type TransferLabel = {
  id: string;
  amount: number;
  occurredAt: Date;
  createdAt: Date;
};

export type TransactionListTableTransferRow = {
  kind: 'transfer';
  source: 'transfers';
  transfer: TransferLabel;
  fromAccount: AccountLabel;
  toAccount: AccountLabel;
};

export type TransactionListRow =
  | TransactionListTransactionRow
  | TransactionListTransactionTransferRow
  | TransactionListTableTransferRow;

type SortableRow = {
  occurredAt: Date;
  createdAt: Date;
  id: string;
};

function compareRows(left: SortableRow, right: SortableRow): number {
  const occurredAt = right.occurredAt.getTime() - left.occurredAt.getTime();
  if (occurredAt !== 0) return occurredAt;
  const createdAt = right.createdAt.getTime() - left.createdAt.getTime();
  if (createdAt !== 0) return createdAt;
  return right.id.localeCompare(left.id);
}

function accountLabel(row: { id: string; name: string; kind: 'bank' | 'cash' }): AccountLabel {
  return { id: row.id, name: row.name, kind: row.kind };
}

function transactionPredicates(
  filters: TransactionListFilters,
  start: Date,
  end: Date
) : SQL[] {
  const predicates: Array<SQL | undefined> = [
    activeRowFilter(transactions.deletedAt),
    gte(transactions.occurredAt, start),
    lt(transactions.occurredAt, end),
  ];
  if (filters.categoryId !== null) {
    predicates.push(eq(transactions.categoryId, filters.categoryId));
  }
  if (filters.accountId !== null) {
    predicates.push(eq(transactions.accountId, filters.accountId));
  }
  if (filters.quality === 'unrated') {
    predicates.push(isNull(transactions.quality), eq(transactions.direction, 'expense'));
  } else if (filters.quality !== null) {
    predicates.push(eq(transactions.quality, filters.quality), eq(transactions.direction, 'expense'));
  }
  return predicates.filter((predicate): predicate is SQL => predicate !== undefined);
}

function transferPredicates(
  filters: TransactionListFilters,
  start: Date,
  end: Date
) : SQL[] {
  const predicates: Array<SQL | undefined> = [
    activeRowFilter(transfers.deletedAt),
    gte(transfers.occurredAt, start),
    lt(transfers.occurredAt, end),
  ];
  if (filters.accountId !== null) {
    predicates.push(
      or(
        eq(transfers.fromAccountId, filters.accountId),
        eq(transfers.toAccountId, filters.accountId)
      )
    );
  }
  if (filters.categoryId !== null) {
    predicates.push(sql`0`);
  }
  if (filters.quality !== null) {
    predicates.push(sql`0`);
  }
  return predicates.filter((predicate): predicate is SQL => predicate !== undefined);
}

function categoryLabel(row: {
  categoryId: string | null;
  categoryName: string | null;
  groupId: string | null;
  groupName: string | null;
}): CategoryLabel | null {
  if (
    row.categoryId === null ||
    row.categoryName === null ||
    row.groupId === null ||
    row.groupName === null
  ) {
    return null;
  }
  return {
    id: row.categoryId,
    name: row.categoryName,
    group: { id: row.groupId, name: row.groupName },
  };
}

export function createTransactionListData<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  changeNotifier: LedgerChangeNotifier = ledgerChangeNotifier
) {
  return {
    async readTransactionList(input: unknown): Promise<TransactionListRow[]> {
      const filters = transactionListFiltersSchema.parse(input);
      const { start, end } = periodBounds(filters.period);

      const transactionRows = await db
        .select({
          transaction: transactions,
          account: {
            id: transactions.accountId,
            name: sql<string>`(
              SELECT name FROM accounts
              WHERE accounts.id = ${transactions.accountId}
            )`,
            kind: sql<'bank' | 'cash'>`(
              SELECT kind FROM accounts
              WHERE accounts.id = ${transactions.accountId}
            )`,
          },
          categoryId: transactions.categoryId,
          categoryName: sql<string | null>`(
            SELECT name FROM categories AS leaf
            WHERE leaf.id = ${transactions.categoryId}
          )`,
          groupId: sql<string | null>`(
            SELECT parent.id
            FROM categories AS leaf
            JOIN categories AS parent ON parent.id = leaf.parent_id
            WHERE leaf.id = ${transactions.categoryId}
          )`,
          groupName: sql<string | null>`(
            SELECT parent.name
            FROM categories AS leaf
            JOIN categories AS parent ON parent.id = leaf.parent_id
            WHERE leaf.id = ${transactions.categoryId}
          )`,
        })
        .from(transactions)
        .where(and(...transactionPredicates(filters, start, end)) ?? sql`1`)
        .all();

      const transactionListRows: Array<
        TransactionListTransactionRow | TransactionListTransactionTransferRow
      > = transactionRows.map((row) => {
        const transaction = toTransaction(row.transaction);
        const account = accountLabel(row.account);
        if (transaction.direction === 'transfer') {
          return { kind: 'transfer', source: 'transaction', transaction, account };
        }
        return {
          kind: 'transaction',
          transaction,
          account,
          category: categoryLabel({
            categoryId: row.categoryId,
            categoryName: row.categoryName,
            groupId: row.groupId,
            groupName: row.groupName,
          }),
        };
      });

      const tableTransferRows = await db
        .select({
          transfer: {
            id: transfers.id,
            amount: transfers.amount,
            occurredAt: transfers.occurredAt,
            createdAt: transfers.createdAt,
          },
          fromAccount: {
            id: transfers.fromAccountId,
            name: sql<string>`(
              SELECT name FROM accounts
              WHERE accounts.id = ${transfers.fromAccountId}
            )`,
            kind: sql<'bank' | 'cash'>`(
              SELECT kind FROM accounts
              WHERE accounts.id = ${transfers.fromAccountId}
            )`,
          },
          toAccount: {
            id: transfers.toAccountId,
            name: sql<string>`(
              SELECT name FROM accounts
              WHERE accounts.id = ${transfers.toAccountId}
            )`,
            kind: sql<'bank' | 'cash'>`(
              SELECT kind FROM accounts
              WHERE accounts.id = ${transfers.toAccountId}
            )`,
          },
        })
        .from(transfers)
        .where(and(...transferPredicates(filters, start, end)) ?? sql`1`)
        .all();

      const rows: TransactionListRow[] = [
        ...transactionListRows,
        ...tableTransferRows.map((row) => ({
          kind: 'transfer' as const,
          source: 'transfers' as const,
          transfer: row.transfer,
          fromAccount: accountLabel(row.fromAccount),
          toAccount: accountLabel(row.toAccount),
        })),
      ];

      return rows.sort((left, right) => {
        const leftSortable =
          left.kind === 'transfer' && left.source === 'transfers'
            ? {
                id: left.transfer.id,
                occurredAt: left.transfer.occurredAt,
                createdAt: left.transfer.createdAt,
              }
            : {
                id: left.transaction.id,
                occurredAt: left.transaction.occurredAt,
                createdAt: left.transaction.createdAt,
              };
        const rightSortable =
          right.kind === 'transfer' && right.source === 'transfers'
            ? {
                id: right.transfer.id,
                occurredAt: right.transfer.occurredAt,
                createdAt: right.transfer.createdAt,
              }
            : {
                id: right.transaction.id,
                occurredAt: right.transaction.occurredAt,
                createdAt: right.transaction.createdAt,
              };
        return compareRows(leftSortable, rightSortable);
      });
    },

    subscribeToChanges(listener: (change: Parameters<LedgerChangeNotifier['notify']>[0]) => void) {
      return changeNotifier.subscribe(listener);
    },
  };
}

export type TransactionListData<TResultKind extends 'sync' | 'async'> = ReturnType<
  typeof createTransactionListData<TResultKind>
>;
