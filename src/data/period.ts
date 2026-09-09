/**
 * Calendar period values shared by ledger filters and period reports.
 *
 * A period is a local calendar month, so its database bounds are calculated
 * with local Date methods instead of SQLite's UTC conversion.
 */
import { z } from 'zod';

export const PERIOD_START_DAY = 1;

export const periodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'period must be YYYY-MM');

export type Period = z.infer<typeof periodSchema>;

export type PeriodBounds = {
  start: Date;
  end: Date;
};

function periodParts(period: Period): { year: number; month: number } {
  const [yearText, monthText] = period.split('-');
  return { year: Number(yearText), month: Number(monthText) - 1 };
}

function localDateAtMidnight(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month, day);
  return date;
}

function dateOnlyFromLocalDate(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function currentPeriod(now: Date = new Date()): Period {
  const year = now.getFullYear().toString().padStart(4, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return periodSchema.parse(`${year}-${month}`);
}

export function periodBounds(period: unknown): PeriodBounds {
  const parsed = periodSchema.parse(period);
  const { year, month } = periodParts(parsed);
  const start = localDateAtMidnight(year, month, PERIOD_START_DAY);

  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  return { start, end };
}

export function periodStartDate(period: unknown): string {
  const parsed = periodSchema.parse(period);
  const { year, month } = periodParts(parsed);
  return dateOnlyFromLocalDate(localDateAtMidnight(year, month, PERIOD_START_DAY));
}

export function periodEndDate(period: unknown): string {
  const { end } = periodBounds(period);
  end.setDate(end.getDate() - 1);
  return dateOnlyFromLocalDate(end);
}
