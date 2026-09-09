/**
 * Category persistence and relationship checks for the ledger.
 *
 * SQLite stores the group relationship as a nullable foreign key, so this
 * boundary checks the active row facts that a foreign key cannot express.
 */
import { and, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import {
  categoryIdSchema,
  createCategoryInputSchema,
  renameCategoryInputSchema,
  reorderCategoriesInputSchema,
  setCategoryGroupKindInputSchema,
} from './category-validation';
import {
  ledgerChangeNotifier,
  type LedgerChangeNotifier,
} from './ledger-change-notifier';
import type {
  Category,
  CategoryGroup,
  CategoryGroupReference,
  CategoryLeaf,
  CategoryGroupWithLeaves,
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

function categoryNotFound(categoryId: string): Error {
  return new Error(`Active category ${categoryId} was not found`);
}

function categoryOrderMismatch(): Error {
  return new Error('Category order must include every active sibling exactly once');
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

function compareCategoryRows(left: CategoryRow, right: CategoryRow): number {
  if (left.sort !== right.sort) {
    return left.sort - right.sort;
  }
  if (left.name < right.name) return -1;
  if (left.name > right.name) return 1;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
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
  db: LedgerDatabase<TResultKind>,
  changeNotifier: LedgerChangeNotifier = ledgerChangeNotifier
) {
  return {
    async createCategory(input: unknown): Promise<Category> {
      const parsed = createCategoryInputSchema.parse(input);
      if (parsed.level === 'group') {
        const inserted = await db
          .insert(categories)
          .values({
            name: parsed.name,
            sort:
              parsed.sort ??
              sql<number>`COALESCE((SELECT MAX(sort) + 1 FROM categories WHERE parent_id IS NULL AND deleted_at IS NULL), 0)`,
            kind: parsed.kind,
            isSuggestion: false,
          })
          .returning()
          .get();
        if (inserted === undefined) {
          throw new Error('Category group insert returned no row');
        }
        const group = toCategoryGroup(inserted);
        changeNotifier.notify({ table: 'categories', mutation: 'created' });
        return group;
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
            ${
              parsed.sort ??
              sql<number>`COALESCE((SELECT MAX(child.sort) + 1 FROM categories AS child WHERE child.parent_id = ${parsed.groupId} AND child.deleted_at IS NULL), 0)`
            },
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
      const leaf = toCategoryLeaf(inserted, group);
      changeNotifier.notify({ table: 'categories', mutation: 'created' });
      return leaf;
    },

    async listActiveCategoryGroups(): Promise<CategoryGroupWithLeaves[]> {
      const rows = await db
        .select()
        .from(categories)
        .where(activeRowFilter(categories.deletedAt))
        .all();
      const groupRows = rows
        .filter((row) => row.parentId === null)
        .sort(compareCategoryRows);
      const groups = groupRows.map(toCategoryGroup);
      return groups.map((group) => {
        const leaves = rows
          .filter((row) => row.parentId === group.id)
          .sort(compareCategoryRows)
          .map((row) => toCategoryLeaf(row, group));
        return { ...group, leaves };
      });
    },

    async renameCategory(input: unknown): Promise<void> {
      const parsed = renameCategoryInputSchema.parse(input);
      const row = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(eq(categories.id, parsed.categoryId), activeRowFilter(categories.deletedAt))
        )
        .get();
      if (row === undefined) {
        throw categoryNotFound(parsed.categoryId);
      }
      await db
        .update(categories)
        .set({ name: parsed.name, updatedAt: new Date() })
        .where(eq(categories.id, parsed.categoryId))
        .run();
      changeNotifier.notify({ table: 'categories', mutation: 'edited' });
    },

    async setCategoryGroupKind(input: unknown): Promise<void> {
      const parsed = setCategoryGroupKindInputSchema.parse(input);
      const group = await findGroup(db, parsed.groupId, { activeOnly: true });
      if (group === undefined) {
        throw categoryGroupNotFound(parsed.groupId);
      }
      await db
        .update(categories)
        .set({ kind: parsed.kind, updatedAt: new Date() })
        .where(
          or(eq(categories.id, group.id), eq(categories.parentId, group.id))
        )
        .run();
      changeNotifier.notify({ table: 'categories', mutation: 'edited' });
    },

    async reorderCategories(input: unknown): Promise<void> {
      const parsed = reorderCategoriesInputSchema.parse(input);
      const rows = await db
        .select({ id: categories.id, parentId: categories.parentId })
        .from(categories)
        .where(activeRowFilter(categories.deletedAt))
        .all();
      const siblingIds = rows
        .filter((row) =>
          parsed.level === 'group'
            ? row.parentId === null
            : row.parentId === parsed.groupId
        )
        .map((row) => row.id);
      const requestedIds = new Set(parsed.categoryIds);
      if (
        siblingIds.length !== parsed.categoryIds.length ||
        siblingIds.some((id) => !requestedIds.has(id))
      ) {
        throw categoryOrderMismatch();
      }
      const cases = parsed.categoryIds.map(
        (categoryId, index) => sql`WHEN ${categories.id} = ${categoryId} THEN ${index}`
      );
      await db
        .update(categories)
        .set({
          sort: sql`CASE ${sql.join(cases, sql.raw(' '))} ELSE ${categories.sort} END`,
          updatedAt: new Date(),
        })
        .where(inArray(categories.id, parsed.categoryIds))
        .run();
      changeNotifier.notify({ table: 'categories', mutation: 'edited' });
    },

    async softDeleteCategory(categoryId: unknown): Promise<void> {
      const parsedId = categoryIdSchema.parse(categoryId);
      const row = await db
        .select({ id: categories.id, parentId: categories.parentId })
        .from(categories)
        .where(
          and(eq(categories.id, parsedId), activeRowFilter(categories.deletedAt))
        )
        .get();
      if (row === undefined) {
        throw categoryNotFound(parsedId);
      }
      const now = new Date();
      await db
        .update(categories)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            or(eq(categories.id, row.id), eq(categories.parentId, row.id)),
            activeRowFilter(categories.deletedAt)
          )
        )
        .run();
      changeNotifier.notify({ table: 'categories', mutation: 'deleted' });
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
      await this.softDeleteCategory(leaf.id);
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
      changeNotifier.notify({ table: 'categories', mutation: 'deleted' });
    },
  };
}

export type CategoryData<TResultKind extends 'sync' | 'async'> = ReturnType<
  typeof createCategoryData<TResultKind>
>;
