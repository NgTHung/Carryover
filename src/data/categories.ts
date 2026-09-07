/**
 * Category persistence and relationship checks for the ledger.
 *
 * SQLite stores the group relationship as a nullable foreign key, so this
 * boundary checks the active row facts that a foreign key cannot express.
 */
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import {
  categoryIdSchema,
  createCategoryInputSchema,
} from './category-validation';
import type {
  Category,
  CategoryGroup,
  CategoryGroupReference,
  CategoryLeaf,
} from './category-types';
import { activeRowFilter } from './soft-delete';
import {
  categories,
  ledgerTables,
  nowMillisecondsSql,
  uuidV4Sql,
} from './schema';

type LedgerDatabase<TResultKind extends 'sync' | 'async'> = BaseSQLiteDatabase<
  TResultKind,
  unknown,
  typeof ledgerTables
>;

type CategoryRow = typeof categories.$inferSelect;

function categoryGroupNotFound(categoryId: string): Error {
  return new Error(`Active category group ${categoryId} was not found`);
}

function categoryLeafNotFound(categoryId: string): Error {
  return new Error(`Active category leaf ${categoryId} was not found`);
}

function historicalGroupNotFound(categoryId: string): Error {
  return new Error(`Category leaf ${categoryId} has no historical group`);
}

function toCategoryGroup(row: CategoryRow): CategoryGroup {
  if (row.parentId !== null) {
    throw new Error(`Category ${row.id} is not a group`);
  }
  return {
    level: 'group',
    id: row.id,
    name: row.name,
    sort: row.sort,
    kind: row.kind,
    isSuggestion: row.isSuggestion,
    deletedAt: row.deletedAt,
  };
}

function toGroupReference(group: CategoryGroup): CategoryGroupReference {
  return {
    level: 'group',
    id: group.id,
    name: group.name,
    sort: group.sort,
    kind: group.kind,
  };
}

function toCategoryLeaf(row: CategoryRow, group: CategoryGroup): CategoryLeaf {
  if (row.parentId === null) {
    throw new Error(`Category ${row.id} is not a leaf`);
  }
  return {
    level: 'leaf',
    id: row.id,
    name: row.name,
    sort: row.sort,
    kind: row.kind,
    isSuggestion: row.isSuggestion,
    deletedAt: row.deletedAt,
    group: toGroupReference(group),
  };
}

async function findGroup<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  groupId: string,
  options: { activeOnly: boolean }
): Promise<CategoryGroup | undefined> {
  const row = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.id, groupId),
        isNull(categories.parentId),
        options.activeOnly ? activeRowFilter(categories.deletedAt) : undefined
      )
    )
    .get();
  return row === undefined ? undefined : toCategoryGroup(row);
}

async function findLeaf<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  leafId: string,
  options: { activeOnly: boolean }
): Promise<CategoryLeaf | undefined> {
  const row = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.id, leafId),
        isNotNull(categories.parentId),
        options.activeOnly ? activeRowFilter(categories.deletedAt) : undefined
      )
    )
    .get();
  if (row === undefined || row.parentId === null) {
    return undefined;
  }

  const group = await findGroup(db, row.parentId, options);
  if (group === undefined) {
    return undefined;
  }
  return toCategoryLeaf(row, group);
}

export function createCategoryData<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>
) {
  return {
    async createCategory(input: unknown): Promise<Category> {
      const parsed = createCategoryInputSchema.parse(input);
      if (parsed.level === 'group') {
        const inserted = await db
          .insert(categories)
          .values({
            name: parsed.name,
            sort: parsed.sort,
            kind: parsed.kind,
            isSuggestion: false,
          })
          .returning()
          .get();
        if (inserted === undefined) {
          throw new Error('Category group insert returned no row');
        }
        return toCategoryGroup(inserted);
      }

      const inserted = await db
        .insert(categories)
        // One statement prevents suggestion deletion from invalidating the group before the write.
        .select(sql`
          SELECT
            ${uuidV4Sql},
            ${nowMillisecondsSql()},
            ${nowMillisecondsSql()},
            NULL,
            ${categories.id},
            ${parsed.name},
            ${parsed.sort},
            ${categories.kind},
            0
          FROM ${categories}
          WHERE ${categories.id} = ${parsed.groupId}
            AND ${categories.parentId} IS NULL
            AND ${categories.deletedAt} IS NULL
        `)
        .returning()
        .get();
      if (inserted === undefined) {
        throw categoryGroupNotFound(parsed.groupId);
      }
      const group = await findGroup(db, parsed.groupId, { activeOnly: true });
      if (group === undefined) {
        throw categoryGroupNotFound(parsed.groupId);
      }
      return toCategoryLeaf(inserted, group);
    },

    async requireActiveLeafCategory(categoryId: unknown): Promise<CategoryLeaf> {
      const parsedId = categoryIdSchema.parse(categoryId);
      const leaf = await findLeaf(db, parsedId, { activeOnly: true });
      if (leaf === undefined) {
        throw categoryLeafNotFound(parsedId);
      }
      return leaf;
    },

    async readLeafReference(categoryId: unknown): Promise<CategoryLeaf | undefined> {
      const parsedId = categoryIdSchema.parse(categoryId);
      const leaf = await findLeaf(db, parsedId, { activeOnly: false });
      if (leaf === undefined) {
        const row = await db
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.id, parsedId))
          .get();
        if (row !== undefined) {
          throw historicalGroupNotFound(parsedId);
        }
      }
      return leaf;
    },

    async softDeleteLeaf(categoryId: unknown): Promise<void> {
      const parsedId = categoryIdSchema.parse(categoryId);
      const leaf = await findLeaf(db, parsedId, { activeOnly: true });
      if (leaf === undefined) {
        throw categoryLeafNotFound(parsedId);
      }
      const now = new Date();
      await db
        .update(categories)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(eq(categories.id, leaf.id), activeRowFilter(categories.deletedAt))
        )
        .run();
    },

    async deleteSuggestedCategories(): Promise<void> {
      const adoptedGroup = sql`
        ${categories.parentId} IS NULL
        AND EXISTS (
          SELECT 1
          FROM ${categories} AS adopted_leaf
          WHERE adopted_leaf.parent_id = ${categories.id}
            AND adopted_leaf.deleted_at IS NULL
            AND adopted_leaf.is_suggestion = 0
        )
      `;
      const now = new Date();
      await db
        .update(categories)
        .set({
          isSuggestion: sql`CASE WHEN ${adoptedGroup} THEN 0 ELSE 1 END`,
          deletedAt: sql`CASE WHEN ${adoptedGroup} THEN NULL ELSE ${now.getTime()} END`,
          updatedAt: now,
        })
        .where(
          and(eq(categories.isSuggestion, true), activeRowFilter(categories.deletedAt))
        )
        .run();
    },
  };
}

export type CategoryData<TResultKind extends 'sync' | 'async'> = ReturnType<
  typeof createCategoryData<TResultKind>
>;
