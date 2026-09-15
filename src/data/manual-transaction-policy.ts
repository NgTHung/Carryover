/**
 * Rules shared by manual transaction and transfer writes.
 *
 * Manual dates are compared as local calendar values. A later clock time on
 * today is valid, while a date from tomorrow is rejected even when its UTC
 * representation is still the previous day. Transfers use the same rule
 * because they record money that has already moved.
 */
import { compareDateOnly, dateOnlyFromLocalDate } from './date-only';

export function assertManualOccurredAt(occurredAt: Date, now: Date): void {
  const occurredOn = dateOnlyFromLocalDate(occurredAt);
  const today = dateOnlyFromLocalDate(now);
  if (compareDateOnly(occurredOn, today) > 0) {
    throw new RangeError('Manual transaction date cannot be in the future');
  }
}

export function optionalManualText(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}
