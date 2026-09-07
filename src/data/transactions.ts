/**
 * Persistence boundary for transaction drafts and complete ledger rows.
 *
 * The database stores nullable columns, while this module returns the status
 * union and explicit payer value that callers need. Category validation stays
 * with DATA-003, and every category-bearing write goes through that boundary.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { createCategoryData, type CategoryData } from './categories';
import { activeRowFilter, type SoftDeleteOptions } from './soft-delete';
import {
  completeDraftInputSchema,
  createTransactionInputSchema,
  editTransactionInputSchema,
  transactionIdSchema,
  transactionSchema,
  type CreateTransactionInput,
  type EditTransactionInput,
  type Transaction,
} from './transaction-validation';
import { nullableIdFromPayer, payerFromNullableId } from './payer';
import {
  categories,
  ledgerTables,
  nowMillisecondsSql,
  transactions,
  uuidV4Sql,
} from './schema';

type LedgerDatabase<TResultKind extends 'sync' | 'async'> = BaseSQLiteDatabase<
  TResultKind,
  unknown,
  typeof ledgerTables
>;

type TransactionRow = typeof transactions.$inferSelect;

function transactionNotFound(transactionId: string): Error {
  return new Error(`Active transaction ${transactionId} was not found`);
}

function transactionInsertFailed(): Error {
  return new Error('Transaction insert returned no row');
}

function categoryWriteFailed(categoryId: string): Error {
  return new Error(`Active category leaf ${categoryId} was not found`);
}

function toTransaction(row: TransactionRow): Transaction {
  return transactionSchema.parse({
    id: row.id,
    accountId: row.accountId,
    direction: row.direction,
    amount: row.amount,
    categoryId: row.categoryId,
    quality: row.quality,
    payer: payerFromNullableId(row.payerContactId),
    occurredAt: row.occurredAt,
    status: row.status,
    photoKey: row.photoKey,
    note: row.note,
    sourceLabel: row.sourceLabel,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  });
}

function insertValues(input: CreateTransactionInput) {
  return {
    accountId: input.accountId,
    direction: input.direction,
    amount: input.amount,
    categoryId: input.categoryId,
    quality: input.quality,
    payerContactId: nullableIdFromPayer(input.payer),
    occurredAt: input.occurredAt,
    status: input.status,
    photoKey: input.photoKey,
    note: input.note,
    sourceLabel: input.sourceLabel,
  };
}

function activeCategoryCondition(categoryId: string) {
  return sql`
    EXISTS (
      SELECT 1
      FROM ${categories} AS leaf
      JOIN ${categories} AS parent ON parent.id = leaf.parent_id
      WHERE leaf.id = ${categoryId}
        AND leaf.parent_id IS NOT NULL
        AND leaf.deleted_at IS NULL
        AND parent.parent_id IS NULL
        AND parent.deleted_at IS NULL
    )
  `;
}

async function insertWithActiveCategory<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  input: CreateTransactionInput & { categoryId: string }
): Promise<TransactionRow> {
  const inserted = await db
    .insert(transactions)
    .select(sqlForActiveCategoryInsert(input))
    .returning()
    .get();
  if (inserted === undefined) {
    throw categoryWriteFailed(input.categoryId);
  }
  return inserted;
}

function sqlForActiveCategoryInsert(
  input: CreateTransactionInput & { categoryId: string }
) {
  return sql`
    SELECT
      ${uuidV4Sql},
      ${nowMillisecondsSql()},
      ${nowMillisecondsSql()},
      NULL,
      ${input.accountId},
      ${input.direction},
      ${input.amount},
      ${input.categoryId},
      ${input.quality},
      ${nullableIdFromPayer(input.payer)},
      ${input.occurredAt.getTime()},
      ${input.status},
      ${input.photoKey},
      ${input.note},
      ${input.sourceLabel}
    FROM ${categories} AS leaf
    JOIN ${categories} AS parent ON parent.id = leaf.parent_id
    WHERE leaf.id = ${input.categoryId}
      AND leaf.parent_id IS NOT NULL
      AND leaf.deleted_at IS NULL
      AND parent.parent_id IS NULL
      AND parent.deleted_at IS NULL
  `;
}

async function findTransaction<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  transactionId: string,
  options: SoftDeleteOptions = {}
): Promise<Transaction | undefined> {
  const row = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, transactionId),
        activeRowFilter(transactions.deletedAt, options)
      )
    )
    .get();
  return row === undefined ? undefined : toTransaction(row);
}

async function updateTransactionRow<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  categoryData: CategoryData<TResultKind>,
  transaction: Transaction
): Promise<TransactionRow> {
  if (transaction.categoryId !== null) {
    await categoryData.requireActiveLeafCategory(transaction.categoryId);
  }

  const updated = await db
    .update(transactions)
    .set({
      accountId: transaction.accountId,
      direction: transaction.direction,
      amount: transaction.amount,
      categoryId: transaction.categoryId,
      quality: transaction.quality,
      payerContactId: nullableIdFromPayer(transaction.payer),
      occurredAt: transaction.occurredAt,
      status: transaction.status,
      photoKey: transaction.photoKey,
      note: transaction.note,
      sourceLabel: transaction.sourceLabel,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(transactions.id, transaction.id),
        activeRowFilter(transactions.deletedAt),
        transaction.categoryId === null
          ? undefined
          : activeCategoryCondition(transaction.categoryId)
      )
    )
    .returning()
    .get();

  if (updated === undefined) {
    throw transaction.categoryId === null
      ? transactionNotFound(transaction.id)
      : categoryWriteFailed(transaction.categoryId);
  }
  return updated;
}

function mergeTransactionChanges(
  transaction: Transaction,
  changes: EditTransactionInput['changes']
): Transaction {
  return transactionSchema.parse({ ...transaction, ...changes });
}

export function createTransactionData<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  categoryData: CategoryData<TResultKind> = createCategoryData(db)
) {
  return {
    async createTransaction(input: unknown): Promise<Transaction> {
      const parsed = createTransactionInputSchema.parse(input);
      const categoryId = parsed.categoryId;
      if (categoryId !== null) {
        await categoryData.requireActiveLeafCategory(categoryId);
        const inserted = await insertWithActiveCategory(db, {
          ...parsed,
          categoryId,
        });
        return toTransaction(inserted);
      }

      const inserted = await db
        .insert(transactions)
        .values(insertValues(parsed))
        .returning()
        .get();
      if (inserted === undefined) {
        throw transactionInsertFailed();
      }
      return toTransaction(inserted);
    },

    async readTransaction(
      transactionId: unknown,
      options: SoftDeleteOptions = {}
    ): Promise<Transaction | undefined> {
      const parsedId = transactionIdSchema.parse(transactionId);
      return findTransaction(db, parsedId, options);
    },

    async readTransactions(
      options: SoftDeleteOptions = {}
    ): Promise<Transaction[]> {
      const rows = await db
        .select()
        .from(transactions)
        .where(activeRowFilter(transactions.deletedAt, options))
        .all();
      return rows.map(toTransaction);
    },

    async editTransaction(input: unknown): Promise<Transaction> {
      const parsed = editTransactionInputSchema.parse(input);
      const existing = await findTransaction(db, parsed.transactionId);
      if (existing === undefined) {
        throw transactionNotFound(parsed.transactionId);
      }
      const candidate = mergeTransactionChanges(existing, parsed.changes);
      const updated = await updateTransactionRow(db, categoryData, candidate);
      return toTransaction(updated);
    },

    async completeDraft(input: unknown): Promise<Transaction> {
      const parsed = completeDraftInputSchema.parse(input);
      const existing = await findTransaction(db, parsed.transactionId);
      if (existing === undefined) {
        throw transactionNotFound(parsed.transactionId);
      }
      if (existing.status !== 'draft') {
        throw new Error(`Transaction ${parsed.transactionId} is already complete`);
      }

      const categoryId =
        parsed.categoryId === undefined
          ? existing.categoryId
          : parsed.categoryId;
      const candidate = transactionSchema.parse({
        ...existing,
        status: 'complete',
        amount: parsed.amount,
        categoryId,
      });
      const updated = await updateTransactionRow(db, categoryData, candidate);
      return toTransaction(updated);
    },

    async softDeleteTransaction(transactionId: unknown): Promise<void> {
      const parsedId = transactionIdSchema.parse(transactionId);
      const updated = await db
        .update(transactions)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(transactions.id, parsedId),
            activeRowFilter(transactions.deletedAt)
          )
        )
        .returning()
        .get();
      if (updated === undefined) {
        throw transactionNotFound(parsedId);
      }
    },
  };
}

export type TransactionData<TResultKind extends 'sync' | 'async'> = ReturnType<
  typeof createTransactionData<TResultKind>
>;
