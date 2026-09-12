/**
 * Reads one period's report input from SQLite.
 *
 * The caller may bind this factory to an exclusive SQLite transaction. That
 * keeps the stored month config, category labels, transactions, and shares on
 * the same committed view before the pure report engine runs.
 */
import {
  and,
  gte,
  inArray,
  lt,
  sql,
} from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { dateOnlyFromLocalDate } from './date-only';
import { createMonthConfigData } from './month-config';
import { periodBounds, periodSchema, type Period } from './period';
import { activeRowFilter } from './soft-delete';
import { ledgerTables, splits, transactions } from './schema';
import {
  computeMonthSummary,
  type MonthSummary,
  type MonthSummaryTransaction,
} from '../reports/month-summary';

type LedgerDatabase<TResultKind extends 'sync' | 'async'> = BaseSQLiteDatabase<
  TResultKind,
  unknown,
  typeof ledgerTables
>;

type MonthSummaryTransactionRow = typeof transactions.$inferSelect & {
  leafName: string | null;
  groupId: string | null;
  groupName: string | null;
};

function summaryTransaction(row: MonthSummaryTransactionRow): MonthSummaryTransaction {
  const group =
    row.groupId === null || row.groupName === null
      ? null
      : { id: row.groupId, name: row.groupName };
  const leaf =
    row.categoryId === null || row.leafName === null
      ? null
      : { id: row.categoryId, name: row.leafName };

  return {
    id: row.id,
    direction: row.direction,
    status: row.status,
    amount: row.amount,
    quality: row.quality,
    occurredOn: dateOnlyFromLocalDate(row.occurredAt),
    group,
    leaf,
  };
}

export function createMonthSummaryData<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>
) {
  return {
    async readMonthSummary(periodInput: unknown): Promise<MonthSummary | undefined> {
      const period = periodSchema.parse(periodInput);
      const config = await createMonthConfigData(db).readMonthConfig(period);
      if (config === undefined) return undefined;

      const { start, end } = periodBounds(period);
      const rows = await db
        .select({
          id: transactions.id,
          createdAt: transactions.createdAt,
          updatedAt: transactions.updatedAt,
          deletedAt: transactions.deletedAt,
          accountId: transactions.accountId,
          direction: transactions.direction,
          adjustmentEffect: transactions.adjustmentEffect,
          amount: transactions.amount,
          categoryId: transactions.categoryId,
          quality: transactions.quality,
          payerContactId: transactions.payerContactId,
          occurredAt: transactions.occurredAt,
          status: transactions.status,
          photoKey: transactions.photoKey,
          note: transactions.note,
          sourceLabel: transactions.sourceLabel,
          leafName: sql<string | null>`(
            SELECT leaf.name
            FROM categories AS leaf
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
        .where(
          and(
            activeRowFilter(transactions.deletedAt),
            gte(transactions.occurredAt, start),
            lt(transactions.occurredAt, end)
          )
        )
        .all() as MonthSummaryTransactionRow[];

      const transactionIds = rows.map((row) => row.id);
      const shareRows =
        transactionIds.length === 0
          ? []
          : await db
              .select({
                transactionId: splits.transactionId,
                contactId: splits.contactId,
                shareAmount: splits.shareAmount,
              })
              .from(splits)
              .where(
                and(
                  activeRowFilter(splits.deletedAt),
                  inArray(splits.transactionId, transactionIds)
                )
              )
              .all();

      return computeMonthSummary({
        period,
        monthConfig: config,
        transactions: rows.map(summaryTransaction),
        shares: shareRows,
      });
    },
  };
}

export type MonthSummaryData<TResultKind extends 'sync' | 'async'> = ReturnType<
  typeof createMonthSummaryData<TResultKind>
>;
