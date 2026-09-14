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

export function dateOnlyFromLocalDate(date: Date): DateOnly {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return dateOnlySchema.parse(`${year}-${month}-${day}`);
}

export function localDateFromDateOnly(dateOnly: DateOnly, anchor: Date): Date {
  const parsed = dateOnlySchema.parse(dateOnly);
  if (Number.isNaN(anchor.getTime())) {
    throw new RangeError('cannot anchor a date-only value to an invalid date');
  }

  const [yearText, monthText, dayText] = parsed.split('-');
  const result = new Date(anchor.getTime());
  result.setFullYear(Number(yearText), Number(monthText) - 1, Number(dayText));
  if (
    result.getFullYear() !== Number(yearText) ||
    result.getMonth() !== Number(monthText) - 1 ||
    result.getDate() !== Number(dayText)
  ) {
    throw new RangeError(`date-only value ${parsed} could not be represented locally`);
  }
  return result;
}

export function compareDateOnly(left: DateOnly, right: DateOnly): -1 | 0 | 1 {
  const parsedLeft = dateOnlySchema.parse(left);
  const parsedRight = dateOnlySchema.parse(right);
  if (parsedLeft === parsedRight) return 0;
  return parsedLeft < parsedRight ? -1 : 1;
}
