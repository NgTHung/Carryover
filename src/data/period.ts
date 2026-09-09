/**
 * Calendar period values shared by ledger filters and period reports.
 *
 * A period is a local calendar month, so its database bounds are calculated
 * with local Date methods instead of SQLite's UTC conversion.
 */
import { z } from 'zod';

export const periodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'period must be YYYY-MM');

export type Period = z.infer<typeof periodSchema>;

export type PeriodBounds = {
  start: Date;
  end: Date;
};

export function currentPeriod(now: Date = new Date()): Period {
  const year = now.getFullYear().toString().padStart(4, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return periodSchema.parse(`${year}-${month}`);
}

export function periodBounds(period: unknown): PeriodBounds {
  const parsed = periodSchema.parse(period);
  const [yearText, monthText] = parsed.split('-');
  const year = Number(yearText);
  const month = Number(monthText) - 1;

  const start = new Date(0);
  start.setHours(0, 0, 0, 0);
  start.setFullYear(year, month, 1);

  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  return { start, end };
}
