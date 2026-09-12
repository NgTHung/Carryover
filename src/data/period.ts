/**
 * Calendar period values shared by ledger filters and period reports.
 *
 * A period is a local calendar month, so its database bounds are calculated
 * with local Date methods instead of SQLite's UTC conversion.
 */
import { z } from 'zod';

import { dateOnlyFromLocalDate, dateOnlySchema, type DateOnly } from './date-only';

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

export function currentPeriod(now: Date = new Date()): Period {
  const year = now.getFullYear().toString().padStart(4, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return periodSchema.parse(`${year}-${month}`);
}

export function shiftPeriod(period: Period, offset: -1 | 1): Period {
  const { year, month } = periodParts(periodSchema.parse(period));
  const shifted = localDateAtMidnight(year, month + offset, PERIOD_START_DAY);
  return periodSchema.parse(
    `${shifted.getFullYear().toString().padStart(4, '0')}-${(shifted.getMonth() + 1)
      .toString()
      .padStart(2, '0')}`
  );
}

const PERIOD_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function formatPeriod(period: Period): string {
  const { year, month } = periodParts(periodSchema.parse(period));
  return `${PERIOD_MONTH_NAMES[month]} ${year}`;
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

export function periodDayCount(period: unknown): number {
  const parsed = periodSchema.parse(period);
  const { year, month } = periodParts(parsed);
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function periodDayDate(period: unknown, day: number): DateOnly {
  const parsed = periodSchema.parse(period);
  if (!Number.isInteger(day) || day < 1 || day > periodDayCount(parsed)) {
    throw new RangeError(`day ${day} does not belong to period ${parsed}`);
  }
  const { year, month } = periodParts(parsed);
  return dateOnlySchema.parse(
    `${year.toString().padStart(4, '0')}-${(month + 1)
      .toString()
      .padStart(2, '0')}-${day.toString().padStart(2, '0')}`
  );
}

export function periodWeekdayIndex(period: unknown, day: number): number {
  const parsed = periodSchema.parse(period);
  const date = periodDayDate(parsed, day);
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (weekday + 6) % 7;
}
