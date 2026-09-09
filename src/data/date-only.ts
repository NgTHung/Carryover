/**
 * Date-only values stay as calendar strings at data boundaries.
 *
 * Parsing these values through `new Date('YYYY-MM-DD')` applies UTC rules,
 * which can move a date across a local midnight. The validator therefore
 * checks the calendar fields directly and leaves the value as a string.
 */
import { z } from 'zod';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export const dateOnlySchema = z
  .string()
  .regex(DATE_ONLY_PATTERN, 'date must be YYYY-MM-DD')
  .superRefine((value, context) => {
    const match = DATE_ONLY_PATTERN.exec(value);
    if (match === null) {
      return;
    }

    const month = Number(match[2]);
    const day = Number(match[3]);
    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > daysInMonth(Number(match[1]), month)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'date is not a valid calendar date',
      });
    }
  });

export type DateOnly = z.infer<typeof dateOnlySchema>;
