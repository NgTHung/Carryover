/**
 * Runtime contracts for category creation and category identifiers.
 *
 * The leaf input carries only an untrusted group ID. The data layer must look
 * that ID up before it can construct a CategoryLeaf with a typed group.
 */
import { z } from 'zod';

const categoryNameSchema = z.string().trim().min(1);
const categorySortSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const categoryKindSchema = z.enum(['spend', 'reserve']);
export const categoryIdSchema = z.string().uuid();

export const createCategoryInputSchema = z.discriminatedUnion('level', [
  z
    .object({
      level: z.literal('group'),
      name: categoryNameSchema,
      sort: categorySortSchema,
      kind: categoryKindSchema,
    })
    .strict(),
  z
    .object({
      level: z.literal('leaf'),
      name: categoryNameSchema,
      sort: categorySortSchema,
      groupId: categoryIdSchema,
    })
    .strict(),
]);

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
export type ValidatedCategoryKind = z.infer<typeof categoryKindSchema>;
