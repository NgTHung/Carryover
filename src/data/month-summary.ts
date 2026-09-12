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

import {
  dateOnlyFromLocalDate,
  dateOnlySchema,
  type DateOnly,
} from './date-only';
import { createMonthConfigData } from './month-config';
import { periodBounds, periodSchema, type Period } from './period';
import { activeRowFilter } from './soft-delete';
import {
  ledgerTables,
  monthConfig as monthConfigTable,
  splits,
  transactions,
} from './schema';
import {
  computeMonthSummary,
  type MonthSummaryInput,
  type MonthSummaryWithHistory,
  type MonthSummaryTransaction,
} from '../reports/month-summary';
import { computePeriodHistory } from '../reports/period-history';
import type { OwnExpenseShare } from '../money/own-expense';
import { monthConfigSchema, type MonthConfig } from './month-config-validation';

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

type MonthConfigRow = typeof monthConfigTable.$inferSelect;

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

function summaryMonthConfig(row: MonthConfigRow): MonthConfig {
  return monthConfigSchema.parse({
    period: row.period,
    openingBalance: row.openingBalance,
    incomeTotal: row.incomeTotal,
    reservedTotal: row.reservedTotal,
    horizonDate: row.horizonDate,
  });
}

async function readReferenceConfigs<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  selectedPeriod: Period,
  today: DateOnly
): Promise<MonthConfig[]> {
  const todayPeriod = today.slice(0, 7);
  const rows = await db
    .select()
    .from(monthConfigTable)
    .where(
      and(
        activeRowFilter(monthConfigTable.deletedAt),
        lt(monthConfigTable.period, selectedPeriod),
        lt(monthConfigTable.period, todayPeriod)
      )
    )
    .all();
  return rows
    .map(summaryMonthConfig)
    .sort((left, right) => left.period.localeCompare(right.period));
}

function monthSummaryInput(
  config: MonthConfig,
  rowsByPeriod: ReadonlyMap<Period, readonly MonthSummaryTransactionRow[]>,
  sharesByTransaction: ReadonlyMap<string, readonly OwnExpenseShare[]>
): MonthSummaryInput {
  const rows = rowsByPeriod.get(config.period) ?? [];
  return {
    period: config.period,
    monthConfig: config,
    transactions: rows.map(summaryTransaction),
    shares: rows.flatMap((row) => sharesByTransaction.get(row.id) ?? []),
  };
}

export function createMonthSummaryData<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>
) {
  return {
    async readMonthSummary(
      periodInput: unknown,
      todayInput: unknown = dateOnlyFromLocalDate(new Date())
    ): Promise<MonthSummaryWithHistory | undefined> {
      const period = periodSchema.parse(periodInput);
      const today = dateOnlySchema.parse(todayInput);
      const config = await createMonthConfigData(db).readMonthConfig(period);
      if (config === undefined) return undefined;

      const referenceConfigs = await readReferenceConfigs(db, period, today);
      const earliestPeriod = referenceConfigs[0]?.period ?? period;
      const { start } = periodBounds(earliestPeriod);
      const { end } = periodBounds(period);
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

      const sharesByTransaction = new Map<string, OwnExpenseShare[]>();
      for (const share of shareRows) {
        const existing = sharesByTransaction.get(share.transactionId) ?? [];
        existing.push(share);
        sharesByTransaction.set(share.transactionId, existing);
      }

      const configuredPeriods = new Set<Period>([
        config.period,
        ...referenceConfigs.map(({ period: referencePeriod }) => referencePeriod),
      ]);
      const rowsByPeriod = new Map<Period, MonthSummaryTransactionRow[]>();
      for (const row of rows) {
        const rowPeriod = dateOnlyFromLocalDate(row.occurredAt).slice(0, 7) as Period;
        if (!configuredPeriods.has(rowPeriod)) continue;
        const periodRows = rowsByPeriod.get(rowPeriod) ?? [];
        periodRows.push(row);
        rowsByPeriod.set(rowPeriod, periodRows);
      }

      const currentInput = monthSummaryInput(config, rowsByPeriod, sharesByTransaction);
      const summary = computeMonthSummary(currentInput);
      const history = computePeriodHistory({
        current: currentInput,
        today,
        references: referenceConfigs.map((referenceConfig) =>
          monthSummaryInput(referenceConfig, rowsByPeriod, sharesByTransaction)
        ),
      });

      return { ...summary, history };
    },
  };
}

export type MonthSummaryData<TResultKind extends 'sync' | 'async'> = ReturnType<
  typeof createMonthSummaryData<TResultKind>
>;
