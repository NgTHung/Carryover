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

const positiveVndAmountTextSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, 'amount must contain whole dong only')
  .superRefine((value, context) => {
    const amount = BigInt(value);
    if (amount <= 0n) {
      context.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: 0,
        inclusive: false,
        type: 'number',
        message: 'amount must be positive',
      });
    }
    if (amount > BigInt(MAX_VND_AMOUNT)) {
      context.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: MAX_VND_AMOUNT,
        inclusive: true,
        type: 'number',
        message: 'amount exceeds the safe VND amount',
      });
    }
  })
  .transform((value) => Number(BigInt(value)));

const blankVndAmountTextSchema = z
  .string()
  .trim()
  .length(0)
  .transform(() => null);

function matchesCurrencyExponent(value: number): boolean {
  return value % CURRENCY_SCALE === 0;
}

export const positiveVndAmountSchema = wholeVndAmountSchema
  .positive()
  .refine(matchesCurrencyExponent, 'amount does not match the VND currency exponent');
export const nonNegativeVndAmountSchema = wholeVndAmountSchema
  .nonnegative()
  .refine(matchesCurrencyExponent, 'amount does not match the VND currency exponent');

export const positiveVndInputSchema = z.union([
  positiveVndAmountSchema,
  positiveVndAmountTextSchema,
]);

export const draftVndInputSchema = z
  .union([
    positiveVndAmountSchema,
    positiveVndAmountTextSchema,
    blankVndAmountTextSchema,
    z.null(),
  ])
  .optional()
  .transform((value) => value ?? null);

export type PositiveVndAmount = z.infer<typeof positiveVndAmountSchema>;
export type NonNegativeVndAmount = z.infer<typeof nonNegativeVndAmountSchema>;
