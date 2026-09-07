/**
 * Runtime schemas for money crossing the data boundary.
 *
 * The schemas share the currency constants with the SQLite adapters, so a
 * value accepted by Zod remains representable when it is read back. They do
 * not coerce input because rounding a captured amount would corrupt the
 * ledger.
 */
import { z } from 'zod';

import {
  CURRENCY_SCALE,
  MAX_VND_AMOUNT,
} from '../money/currency';

const wholeVndAmountSchema = z.number().finite().int().max(MAX_VND_AMOUNT);

function matchesCurrencyExponent(value: number): boolean {
  return value % CURRENCY_SCALE === 0;
}

export const positiveVndAmountSchema = wholeVndAmountSchema
  .positive()
  .refine(matchesCurrencyExponent, 'amount does not match the VND currency exponent');
export const nonNegativeVndAmountSchema = wholeVndAmountSchema
  .nonnegative()
  .refine(matchesCurrencyExponent, 'amount does not match the VND currency exponent');

export type PositiveVndAmount = z.infer<typeof positiveVndAmountSchema>;
export type NonNegativeVndAmount = z.infer<typeof nonNegativeVndAmountSchema>;
