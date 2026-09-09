/**
 * Persistence boundary for per-period month config snapshots.
 *
 * Opening a period freezes its money totals. Later writes can move only the
 * horizon, so report history keeps reading the values captured at open time.
 */
import { and, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import {
  monthConfigSchema,
  openPeriodInputSchema,
  updateHorizonInputSchema,
  type MonthConfig,
} from './month-config-validation';
import {
  ledgerChangeNotifier,
  type LedgerChangeNotifier,
} from './ledger-change-notifier';
import { periodSchema } from './period';
import { ledgerTables, monthConfig } from './schema';
import { activeRowFilter } from './soft-delete';

type LedgerDatabase<TResultKind extends 'sync' | 'async'> = BaseSQLiteDatabase<
  TResultKind,
  unknown,
  typeof ledgerTables
>;

type MonthConfigRow = typeof monthConfig.$inferSelect;

function toMonthConfig(row: MonthConfigRow): MonthConfig {
  return monthConfigSchema.parse({
    period: row.period,
    openingBalance: row.openingBalance,
    incomeTotal: row.incomeTotal,
    reservedTotal: row.reservedTotal,
    horizonDate: row.horizonDate,
  });
}

function monthConfigNotFound(period: string): Error {
  return new Error(`Active month config for period ${period} was not found`);
}

async function findMonthConfig<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  period: string
): Promise<MonthConfigRow | undefined> {
  return db
    .select()
    .from(monthConfig)
    .where(
      and(eq(monthConfig.period, period), activeRowFilter(monthConfig.deletedAt))
    )
    .get();
}

export function createMonthConfigData<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  changeNotifier: LedgerChangeNotifier = ledgerChangeNotifier
) {
  return {
    async openPeriod(input: unknown): Promise<MonthConfig> {
      const parsed = openPeriodInputSchema.parse(input);
      const inserted = await db
        .insert(monthConfig)
        .values({
          period: parsed.period,
          openingBalance: parsed.openingBalance,
          incomeTotal: parsed.incomeTotal,
          reservedTotal: parsed.reservedTotal,
          horizonDate: parsed.horizonDate,
        })
        .onConflictDoNothing({ target: monthConfig.period })
        .returning()
        .get();

      if (inserted !== undefined) {
        changeNotifier.notify({ table: 'month_config', mutation: 'created' });
        return toMonthConfig(inserted);
      }

      const existing = await findMonthConfig(db, parsed.period);
      if (existing === undefined) {
        throw monthConfigNotFound(parsed.period);
      }
      return toMonthConfig(existing);
    },

    async readMonthConfig(period: unknown): Promise<MonthConfig | undefined> {
      const parsedPeriod = periodSchema.parse(period);
      const row = await findMonthConfig(db, parsedPeriod);
      return row === undefined ? undefined : toMonthConfig(row);
    },

    async updateHorizon(input: unknown): Promise<MonthConfig> {
      const parsed = updateHorizonInputSchema.parse(input);
      const existing = await findMonthConfig(db, parsed.period);
      if (existing === undefined) {
        throw monthConfigNotFound(parsed.period);
      }

      const current = toMonthConfig(existing);
      if (current.horizonDate === parsed.horizonDate) {
        return current;
      }

      const updatedAt = new Date(
        Math.max(Date.now(), existing.updatedAt.getTime() + 1)
      );
      const updated = await db
        .update(monthConfig)
        .set({ horizonDate: parsed.horizonDate, updatedAt })
        .where(
          and(
            eq(monthConfig.period, parsed.period),
            eq(monthConfig.updatedAt, existing.updatedAt),
            activeRowFilter(monthConfig.deletedAt)
          )
        )
        .returning()
        .get();
      if (updated === undefined) {
        throw monthConfigNotFound(parsed.period);
      }

      changeNotifier.notify({ table: 'month_config', mutation: 'edited' });
      return toMonthConfig(updated);
    },
  };
}

export type MonthConfigData<TResultKind extends 'sync' | 'async'> = ReturnType<
  typeof createMonthConfigData<TResultKind>
>;
