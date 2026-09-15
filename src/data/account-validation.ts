/**
 * Runtime contracts for account edits and transfers.
 *
 * These schemas run before any database lookup or write, so malformed money
 * cannot partially change the ledger.
 */
import { z } from 'zod';

import {
  nonNegativeVndAmountSchema,
  positiveVndAmountSchema,
} from './money-validation';
import type { AdjustmentEffect } from './transaction-validation';

const accountIdSchema = z.string().uuid();
export const accountNameSchema = z.string().trim().min(1);

export const reconcileAccountSchema = z
  .object({
    accountId: accountIdSchema,
    statedBalance: nonNegativeVndAmountSchema,
    occurredAt: z.date(),
  })
  .strict();

export type ReconcileAccount = z.infer<typeof reconcileAccountSchema>;
export type { AdjustmentEffect } from './transaction-validation';

export const updateAccountOpeningBalanceSchema = z
  .object({
    accountId: accountIdSchema,
    openingBalance: nonNegativeVndAmountSchema,
  })
  .strict();

export type UpdateAccountOpeningBalance = z.infer<
  typeof updateAccountOpeningBalanceSchema
>;

export const editAccountDetailsSchema = z
  .object({
    accountId: accountIdSchema,
    name: accountNameSchema,
    openingBalance: nonNegativeVndAmountSchema,
  })
  .strict();

export type EditAccountDetails = z.infer<typeof editAccountDetailsSchema>;

export const recordTransferSchema = z
  .object({
    fromAccountId: accountIdSchema,
    toAccountId: accountIdSchema,
    amount: positiveVndAmountSchema,
    occurredAt: z.date(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.fromAccountId === input.toAccountId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toAccountId'],
        message: 'A transfer must use two different accounts',
      });
    }
  });

export type RecordTransfer = z.infer<typeof recordTransferSchema>;
