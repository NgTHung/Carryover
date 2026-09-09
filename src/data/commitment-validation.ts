/**
 * Runtime contracts for recurring reserve commitments.
 *
 * Commitment writes carry only an untrusted reserve leaf ID. The persistence
 * boundary must verify that the ID names an active reserve leaf before it
 * writes the row, while this module keeps malformed values out of that lookup.
 */
import { z } from 'zod';

import {
  positiveVndAmountSchema,
  positiveVndInputSchema,
} from './money-validation';

export const commitmentIdSchema = z.string().uuid();
export const commitmentNameSchema = z.string().trim().min(1);
export const commitmentDueDaySchema = z.number().int().min(1).max(31);

const commitmentFields = {
  name: commitmentNameSchema,
  amount: positiveVndAmountSchema,
  dueDay: commitmentDueDaySchema,
  categoryId: commitmentIdSchema,
  active: z.boolean(),
};

export const commitmentSchema = z
  .object({
    id: commitmentIdSchema,
    ...commitmentFields,
    createdAt: z.date(),
    updatedAt: z.date(),
    deletedAt: z.date().nullable(),
  })
  .strict();

export type Commitment = z.infer<typeof commitmentSchema>;

export const createCommitmentInputSchema = z
  .object({
    name: commitmentNameSchema,
    amount: positiveVndInputSchema,
    dueDay: commitmentDueDaySchema,
    categoryId: commitmentIdSchema,
    active: z.boolean().optional().default(true),
  })
  .strict();

export type CreateCommitmentInput = z.infer<
  typeof createCommitmentInputSchema
>;

const commitmentEditChangesSchema = z
  .object({
    name: commitmentNameSchema,
    amount: positiveVndInputSchema,
    dueDay: commitmentDueDaySchema,
    categoryId: commitmentIdSchema,
    active: z.boolean(),
  })
  .partial()
  .strict();

export const editCommitmentInputSchema = z
  .object({
    commitmentId: commitmentIdSchema,
    changes: commitmentEditChangesSchema,
  })
  .strict();

export type EditCommitmentInput = z.infer<typeof editCommitmentInputSchema>;
