/**
 * Resolve a commitment's due day inside a calendar period.
 *
 * Due days are calendar values rather than elapsed durations. A commitment
 * due on the 31st therefore remains in February or a 30-day month by clamping
 * to that month's final day instead of rolling into the next period.
 */
import { dateOnlySchema, type DateOnly } from './date-only';
import { commitmentDueDaySchema } from './commitment-validation';
import { periodSchema, type Period } from './period';

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function resolveCommitmentDueDate(
  period: unknown,
  dueDay: unknown
): DateOnly {
  const parsedPeriod = periodSchema.parse(period) as Period;
  const parsedDueDay = commitmentDueDaySchema.parse(dueDay);
  const [yearText, monthText] = parsedPeriod.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Math.min(parsedDueDay, daysInMonth(year, month));

  return dateOnlySchema.parse(
    `${yearText}-${monthText}-${day.toString().padStart(2, '0')}`
  );
}
