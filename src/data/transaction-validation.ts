/**
 * Runtime contracts for transaction rows and transaction writes.
 *
 * Drafts keep an unknown amount as null. Completion is a separate transition
 * so callers cannot accidentally turn an unknown draft into a zero-valued row.
 */
import { z } from 'zod';

import type { Payer } from './payer';
import {
  draftVndInputSchema,
  positiveVndAmountSchema,
  positiveVndInputSchema,
} from './money-validation';

const idSchema = z.string().uuid();
const directionSchema = z.enum(['expense', 'income', 'adjustment', 'transfer']);
const qualitySchema = z.enum(['need', 'want', 'regret']);
const payerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('you') }).strict(),
  z.object({ kind: z.literal('contact'), contactId: idSchema }).strict(),
]);

export const transactionDirectionSchema = directionSchema;
export const transactionQualitySchema = qualitySchema;
export const transactionPayerSchema = payerSchema;

const nullableIdInputSchema = idSchema.nullable().optional().default(null);
const nullableQualityInputSchema = qualitySchema.nullable().optional().default(null);
const nullablePayerInputSchema = payerSchema
  .optional()
  .default({ kind: 'you' });
const nullableTextInputSchema = z.string().nullable().optional().default(null);

const transactionBaseShape = {
  id: idSchema,
  accountId: idSchema,
  direction: directionSchema,
  categoryId: idSchema.nullable(),
  quality: qualitySchema.nullable(),
  payer: payerSchema,
  occurredAt: z.date(),
  photoKey: z.string().nullable(),
  note: z.string().nullable(),
  sourceLabel: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
};

const draftTransactionSchema = z.object({
  ...transactionBaseShape,
  status: z.literal('draft'),
  amount: positiveVndAmountSchema.nullable(),
});

const completeTransactionSchema = z.object({
  ...transactionBaseShape,
  status: z.literal('complete'),
  amount: positiveVndAmountSchema,
});

function addTransactionSemanticIssues(
  input: {
    status: 'draft' | 'complete';
    direction: z.infer<typeof directionSchema>;
    categoryId: string | null;
    sourceLabel: string | null;
  },
  context: z.RefinementCtx
): void {
  if (
    input.status === 'complete' &&
    input.direction === 'expense' &&
    input.categoryId === null
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['categoryId'],
      message: 'A complete expense requires a leaf category',
    });
  }

  if (
    ['income', 'adjustment', 'transfer'].includes(input.direction) &&
    input.categoryId !== null
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['categoryId'],
      message: `${input.direction} transactions cannot have a category`,
    });
  }

  if (input.direction !== 'income' && input.sourceLabel !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceLabel'],
      message: 'Only income transactions can have a source label',
    });
  }
}

export const transactionSchema = z
  .discriminatedUnion('status', [
    draftTransactionSchema,
    completeTransactionSchema,
  ])
  .superRefine(addTransactionSemanticIssues);

export type Transaction = z.infer<typeof transactionSchema>;
export type DraftTransaction = Extract<Transaction, { status: 'draft' }>;
export type CompleteTransaction = Extract<
  Transaction,
  { status: 'complete' }
>;
export type TransactionPayer = Payer;

const transactionInputBaseShape = {
  accountId: idSchema,
  direction: directionSchema,
  categoryId: nullableIdInputSchema,
  quality: nullableQualityInputSchema,
  payer: nullablePayerInputSchema,
  occurredAt: z.date(),
  photoKey: nullableTextInputSchema,
  note: nullableTextInputSchema,
  sourceLabel: nullableTextInputSchema,
};

const draftTransactionInputSchema = z.object({
  ...transactionInputBaseShape,
  status: z.literal('draft'),
  amount: draftVndInputSchema,
});

const completeTransactionInputSchema = z.object({
  ...transactionInputBaseShape,
  status: z.literal('complete'),
  amount: positiveVndInputSchema,
});

const transactionCreateUnionSchema = z
  .discriminatedUnion('status', [
    draftTransactionInputSchema,
    completeTransactionInputSchema,
  ])
  .superRefine(addTransactionSemanticIssues);

function defaultDraftStatus(input: unknown): unknown {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return input;
  }
  const record = input as Record<string, unknown>;
  return record.status === undefined
    ? { ...record, status: 'draft' }
    : input;
}

export const createTransactionInputSchema = z.preprocess(
  defaultDraftStatus,
  transactionCreateUnionSchema
);

export type CreateTransactionInput = z.infer<
  typeof createTransactionInputSchema
>;

const transactionEditChangesSchema = z
  .object({
    accountId: idSchema,
    direction: directionSchema,
    amount: draftVndInputSchema,
    categoryId: idSchema.nullable(),
    quality: qualitySchema.nullable(),
    payer: payerSchema,
    occurredAt: z.date(),
    photoKey: z.string().nullable(),
    note: z.string().nullable(),
    sourceLabel: z.string().nullable(),
  })
  .partial()
  .strict();

export const editTransactionInputSchema = z
  .object({
    transactionId: idSchema,
    changes: transactionEditChangesSchema,
  })
  .strict();

export type EditTransactionInput = z.infer<
  typeof editTransactionInputSchema
>;

export const completeDraftInputSchema = z
  .object({
    transactionId: idSchema,
    amount: positiveVndInputSchema,
    categoryId: idSchema.nullable().optional(),
  })
  .strict();

export type CompleteDraftInput = z.infer<typeof completeDraftInputSchema>;

export const transactionIdSchema = idSchema;
