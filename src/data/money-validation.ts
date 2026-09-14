/**
 * Runtime schemas for money crossing the data boundary.
 *
 * The schemas share the currency constants with the SQLite adapters, so a
 * value accepted by Zod remains representable when it is read back. They do
 * Text inputs become integers through BigInt, never rounding, before they
 * cross into the ledger.
 */
import { z } from 'zod';

import {
  CURRENCY_SCALE,
  MAX_VND_AMOUNT,
} from '../money/currency';

const wholeVndAmountSchema = z.number().finite().int().max(MAX_VND_AMOUNT);

function vndAmountTextSchema(allowZero: boolean) {
  return z
    .string()
    .trim()
    .regex(/^\d+$/, 'amount must contain whole dong only')
    .superRefine((value, context) => {
      if (!/^\d+$/.test(value)) {
        return;
      }
      const amount = BigInt(value);
      if (amount < 0n || (!allowZero && amount === 0n)) {
        context.addIssue({
          code: z.ZodIssueCode.too_small,
          minimum: 0,
          inclusive: allowZero,
          type: 'number',
          message: allowZero
            ? 'amount must be nonnegative'
            : 'amount must be positive',
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
}

const positiveVndAmountTextSchema = vndAmountTextSchema(false);
const nonNegativeVndAmountTextSchema = vndAmountTextSchema(true);

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
export const signedVndAmountSchema = z
  .number()
  .finite()
  .int()
  .min(-MAX_VND_AMOUNT)
  .max(MAX_VND_AMOUNT)
  .refine(matchesCurrencyExponent, 'amount does not match the VND currency exponent');

export const positiveVndInputSchema = z.union([
  positiveVndAmountSchema,
  positiveVndAmountTextSchema,
]);

export const nonNegativeVndInputSchema = z.union([
  nonNegativeVndAmountSchema,
  nonNegativeVndAmountTextSchema,
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
