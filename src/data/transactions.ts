/**
 * Persistence boundary for transaction drafts and complete ledger rows.
 *
 * The database stores nullable columns, while this module returns the status
 * union and explicit payer value that callers need. Category validation stays
 * with DATA-003, and every category-bearing write goes through that boundary.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import {
  createCategoryData,
  type CategoryData,
} from './categories';
import { activeRowFilter, type SoftDeleteOptions } from './soft-delete';
import {
  createTransactionInputSchema,
  transactionIdSchema,
  transactionSchema,
  type CreateTransactionInput,
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

export function createTransactionData<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  categoryData: CategoryData<TResultKind> = createCategoryData(db)
) {
  return {
    async createTransaction(input: unknown): Promise<Transaction> {
      const parsed = createTransactionInputSchema.parse(input);
      if (parsed.categoryId !== null) {
        await categoryData.requireActiveLeafCategory(parsed.categoryId);
        const inserted = await insertWithActiveCategory(db, parsed as CreateTransactionInput & { categoryId: string });
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
      const row = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.id, parsedId),
            activeRowFilter(transactions.deletedAt, options)
          )
        )
        .get();
      return row === undefined ? undefined : toTransaction(row);
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
  };
}

export type TransactionData<TResultKind extends 'sync' | 'async'> = ReturnType<
  typeof createTransactionData<TResultKind>
>;
