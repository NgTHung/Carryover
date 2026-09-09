/**
 * Runtime contracts for category creation and category identifiers.
 *
 * The leaf input carries only an untrusted group ID. The data layer must look
 * that ID up before it can construct a CategoryLeaf with a typed group.
 */
import { z } from 'zod';

export const categoryNameSchema = z.string().trim().min(1);
const categorySortSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const categoryKindSchema = z.enum(['spend', 'reserve']);
export const categoryIdSchema = z.string().uuid();

export const createCategoryInputSchema = z.discriminatedUnion('level', [
  z
    .object({
      level: z.literal('group'),
      name: categoryNameSchema,
      sort: categorySortSchema.optional(),
      kind: categoryKindSchema,
    })
    .strict(),
  z
    .object({
      level: z.literal('leaf'),
      name: categoryNameSchema,
      sort: categorySortSchema.optional(),
      groupId: categoryIdSchema,
    })
    .strict(),
]);

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
export type ValidatedCategoryKind = z.infer<typeof categoryKindSchema>;

export const renameCategoryInputSchema = z
  .object({
    categoryId: categoryIdSchema,
    name: categoryNameSchema,
  })
  .strict();

export const setCategoryGroupKindInputSchema = z
  .object({
    groupId: categoryIdSchema,
    kind: categoryKindSchema,
  })
  .strict();

const categoryOrderIdsSchema = z
  .array(categoryIdSchema)
  .min(1)
  .superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Category IDs must be unique',
      });
    }
  });

export const reorderCategoriesInputSchema = z.discriminatedUnion('level', [
  z
    .object({
      level: z.literal('group'),
      categoryIds: categoryOrderIdsSchema,
    })
    .strict(),
  z
    .object({
      level: z.literal('leaf'),
      groupId: categoryIdSchema,
      categoryIds: categoryOrderIdsSchema,
    })
    .strict(),
]);

export type RenameCategoryInput = z.infer<typeof renameCategoryInputSchema>;
export type SetCategoryGroupKindInput = z.infer<
  typeof setCategoryGroupKindInputSchema
>;
export type ReorderCategoriesInput = z.infer<
  typeof reorderCategoriesInputSchema
>;
