/**
 * Exact aggregation used while preparing and maintaining period income.
 *
 * SQLite can overflow a 64-bit SUM before JavaScript sees it. These helpers
 * aggregate validated rows with BigInt and reject an unrepresentable result.
 */
import {
  assertNonNegativeVndAmount,
  assertPositiveVndAmount,
  MAX_VND_AMOUNT,
} from '../money/currency';
import { periodBounds, type Period } from './period';

const MAX_VND = BigInt(MAX_VND_AMOUNT);

export type IncomeRow = {
  direction: 'expense' | 'income' | 'adjustment' | 'transfer';
  amount: number | null;
  occurredAt: Date;
};

function safeSignedNumber(value: bigint, field: string): number {
  if (value < -MAX_VND || value > MAX_VND) {
    throw new RangeError(`${field} exceeds the safe VND amount`);
  }
  return Number(value);
}

export function sumKnownIncome(rows: readonly IncomeRow[], period: Period): number {
  const { start, end } = periodBounds(period);
  let total = 0n;
  for (const row of rows) {
    if (
      row.direction !== 'income' ||
      row.amount === null ||
      row.occurredAt < start ||
      row.occurredAt >= end
    ) {
      continue;
    }
    total += BigInt(assertPositiveVndAmount(row.amount, 'income amount'));
    if (total > MAX_VND) {
      throw new RangeError(`income total for ${period} exceeds the safe VND amount`);
    }
  }
  return Number(total);
}

export function sumNonNegativeVnd(
  amounts: readonly number[],
  field: string
): number {
  let total = 0n;
  for (const amount of amounts) {
    total += BigInt(assertNonNegativeVndAmount(amount, field));
    if (total > MAX_VND) {
      throw new RangeError(`${field} exceeds the safe VND amount`);
    }
  }
  return Number(total);
}

export function safeSignedVnd(value: bigint, field: string): number {
  return safeSignedNumber(value, field);
}
