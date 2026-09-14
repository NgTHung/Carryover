/**
 * Persistence for recurring reserve commitments.
 *
 * A commitment points at an active reserve leaf and its active reserve group.
 * The category predicate is part of each write statement so a category cannot
 * be deactivated between validation and the commitment write. Reserved unpaid
 * reads both ledger inputs in one statement so they share a database view.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import {
  readCommitmentPeriodInputs,
  type CommitmentOverview,
  type CommitmentOverviewItem,
} from './commitment-overview';
import {
  commitmentIdSchema,
  commitmentSchema,
  createCommitmentInputSchema,
  editCommitmentInputSchema,
  type Commitment,
  type EditCommitmentInput,
} from './commitment-validation';
import {
  ledgerChangeNotifier,
  type LedgerChangeNotifier,
} from './ledger-change-notifier';
import { activeRowFilter, type SoftDeleteOptions } from './soft-delete';
import {
  categories,
  commitments,
  ledgerTables,
  nowMillisecondsSql,
  uuidV4Sql,
} from './schema';
import { periodSchema, type Period } from './period';

type LedgerDatabase<TResultKind extends 'sync' | 'async'> = BaseSQLiteDatabase<
  TResultKind,
  unknown,
  typeof ledgerTables
>;

export type CommitmentRow = typeof commitments.$inferSelect;

export type {
  CommitmentOverview,
  CommitmentOverviewItem,
  CommitmentOverviewLeaf,
} from './commitment-overview';

function commitmentNotFound(commitmentId: string): Error {
  return new Error(`Active commitment ${commitmentId} was not found`);
}

function commitmentChanged(commitmentId: string): Error {
  return new Error(`Commitment ${commitmentId} changed during update`);
}

function reserveCategoryNotFound(categoryId: string): Error {
  return new Error(`Active reserve category leaf ${categoryId} was not found`);
}

function toCommitment(row: CommitmentRow): Commitment {
  return commitmentSchema.parse({
    id: row.id,
    name: row.name,
    amount: row.amount,
    dueDay: row.dueDay,
    categoryId: row.categoryId,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  });
}

function activeReserveCategoryCondition(categoryId: string) {
  return sql`
    EXISTS (
      SELECT 1
      FROM ${categories} AS leaf
      JOIN ${categories} AS parent ON parent.id = leaf.parent_id
      WHERE leaf.id = ${categoryId}
        AND leaf.parent_id IS NOT NULL
        AND leaf.kind = 'reserve'
        AND leaf.deleted_at IS NULL
        AND parent.parent_id IS NULL
        AND parent.kind = 'reserve'
        AND parent.deleted_at IS NULL
    )
  `;
}

async function hasActiveReserveCategory<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  categoryId: string
): Promise<boolean> {
  const row = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        activeReserveCategoryCondition(categoryId)
      )
    )
    .get();
  return row !== undefined;
}

async function findCommitment<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  commitmentId: string,
  options: SoftDeleteOptions = {}
): Promise<CommitmentRow | undefined> {
  return db
    .select()
    .from(commitments)
    .where(
      and(
        eq(commitments.id, commitmentId),
        activeRowFilter(commitments.deletedAt, options)
      )
    )
    .get();
}

function changedFieldsEqual(left: Commitment, right: Commitment): boolean {
  return (
    left.name === right.name &&
    left.amount === right.amount &&
    left.dueDay === right.dueDay &&
    left.categoryId === right.categoryId &&
    left.active === right.active
  );
}

function mergeCommitmentChanges(
  commitment: Commitment,
  changes: EditCommitmentInput['changes']
): Commitment {
  return commitmentSchema.parse({ ...commitment, ...changes });
}

export function createCommitmentData<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  changeNotifier: LedgerChangeNotifier = ledgerChangeNotifier
) {
  return {
    async createCommitment(input: unknown): Promise<Commitment> {
      const parsed = createCommitmentInputSchema.parse(input);
      const inserted = await db
        .insert(commitments)
        .select(sql`
          SELECT
            ${uuidV4Sql},
            ${nowMillisecondsSql()},
            ${nowMillisecondsSql()},
            NULL,
            ${parsed.name},
            ${parsed.amount},
            ${parsed.dueDay},
            ${parsed.categoryId},
            ${parsed.active ? 1 : 0}
          FROM ${categories} AS leaf
          JOIN ${categories} AS parent ON parent.id = leaf.parent_id
          WHERE leaf.id = ${parsed.categoryId}
            AND leaf.parent_id IS NOT NULL
            AND leaf.kind = 'reserve'
            AND leaf.deleted_at IS NULL
            AND parent.parent_id IS NULL
            AND parent.kind = 'reserve'
            AND parent.deleted_at IS NULL
        `)
        .returning()
        .get();
      if (inserted === undefined) {
        throw reserveCategoryNotFound(parsed.categoryId);
      }
      const commitment = toCommitment(inserted);
      changeNotifier.notify({ table: 'commitments', mutation: 'created' });
      return commitment;
    },

    async readCommitment(
      commitmentId: unknown,
      options: SoftDeleteOptions = {}
    ): Promise<Commitment | undefined> {
      const parsedId = commitmentIdSchema.parse(commitmentId);
      const row = await findCommitment(db, parsedId, options);
      return row === undefined ? undefined : toCommitment(row);
    },

    async readCommitments(
      options: SoftDeleteOptions = {}
    ): Promise<Commitment[]> {
      const rows = await db
        .select()
        .from(commitments)
        .where(activeRowFilter(commitments.deletedAt, options))
        .all();
      return rows.map(toCommitment);
    },

    async readCommitmentOverview(period: unknown): Promise<CommitmentOverview> {
      const parsedPeriod = periodSchema.parse(period) as Period;
      const inputs = await readCommitmentPeriodInputs(db, parsedPeriod);
      const matchesByCommitment = new Map(
        inputs.matches.map((match) => [match.commitment.id, match])
      );
      const nextUnpaidByCategory = new Set<string>();
      const nextUnpaidCommitments = new Set<string>();
      for (const match of inputs.matches) {
        if (
          match.status === 'unpaid' &&
          !nextUnpaidByCategory.has(match.commitment.categoryId)
        ) {
          nextUnpaidByCategory.add(match.commitment.categoryId);
          nextUnpaidCommitments.add(match.commitment.id);
        }
      }

      return {
        period: parsedPeriod,
        unpaidTotal: inputs.unpaidTotal,
        items: inputs.commitments.map((item): CommitmentOverviewItem => {
          if (!item.commitment.active) {
            return { ...item, state: { status: 'inactive' } };
          }
          const match = matchesByCommitment.get(item.commitment.id);
          if (match === undefined) {
            throw new Error(
              `Active commitment ${item.commitment.id} has no reserve match`
            );
          }
          return match.status === 'paid'
            ? {
                ...item,
                state: {
                  status: 'paid',
                  transactionId: match.payment.id,
                },
              }
            : {
                ...item,
                state: {
                  status: 'unpaid',
                  nextToAcceptPayment: nextUnpaidCommitments.has(
                    item.commitment.id
                  ),
                },
              };
        }),
      };
    },

    async readReservedUnpaid(period: unknown): Promise<number> {
      const parsedPeriod = periodSchema.parse(period) as Period;
      const { unpaidTotal } = await readCommitmentPeriodInputs(db, parsedPeriod);
      if (unpaidTotal.status === 'overflow') {
        throw new RangeError('reserved unpaid exceeds the safe VND amount');
      }
      return unpaidTotal.amount;
    },

    async editCommitment(input: unknown): Promise<Commitment> {
      const parsed = editCommitmentInputSchema.parse(input);
      const existingRow = await findCommitment(db, parsed.commitmentId);
      if (existingRow === undefined) {
        throw commitmentNotFound(parsed.commitmentId);
      }
      const existing = toCommitment(existingRow);
      const candidate = mergeCommitmentChanges(existing, parsed.changes);
      if (changedFieldsEqual(existing, candidate)) {
        if (
          (existing.active || parsed.changes.categoryId !== undefined) &&
          !(await hasActiveReserveCategory(db, existing.categoryId))
        ) {
          throw reserveCategoryNotFound(existing.categoryId);
        }
        return existing;
      }

      const validateCategory =
        parsed.changes.categoryId !== undefined || candidate.active;
      const updatedAt = new Date(
        Math.max(Date.now(), existing.updatedAt.getTime() + 1)
      );
      const updated = await db
        .update(commitments)
        .set({
          name: candidate.name,
          amount: candidate.amount,
          dueDay: candidate.dueDay,
          categoryId: candidate.categoryId,
          active: candidate.active,
          updatedAt,
        })
        .where(
          and(
            eq(commitments.id, candidate.id),
            eq(commitments.updatedAt, existing.updatedAt),
            activeRowFilter(commitments.deletedAt),
            validateCategory
              ? activeReserveCategoryCondition(candidate.categoryId)
              : undefined
          )
        )
        .returning()
        .get();

      if (updated === undefined) {
        if (
          validateCategory &&
          !(await hasActiveReserveCategory(db, candidate.categoryId))
        ) {
          throw reserveCategoryNotFound(candidate.categoryId);
        }
        const current = await findCommitment(db, candidate.id);
        if (current === undefined) {
          throw commitmentNotFound(candidate.id);
        }
        throw commitmentChanged(candidate.id);
      }
      const commitment = toCommitment(updated);
      changeNotifier.notify({ table: 'commitments', mutation: 'edited' });
      return commitment;
    },

    async softDeleteCommitment(commitmentId: unknown): Promise<void> {
      const parsedId = commitmentIdSchema.parse(commitmentId);
      const existing = await findCommitment(db, parsedId);
      if (existing === undefined) {
        throw commitmentNotFound(parsedId);
      }
      const now = new Date(
        Math.max(Date.now(), existing.updatedAt.getTime() + 1)
      );
      const updated = await db
        .update(commitments)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            eq(commitments.id, parsedId),
            eq(commitments.updatedAt, existing.updatedAt),
            activeRowFilter(commitments.deletedAt)
          )
        )
        .returning()
        .get();
      if (updated === undefined) {
        const current = await findCommitment(db, parsedId);
        if (current === undefined) {
          throw commitmentNotFound(parsedId);
        }
        throw commitmentChanged(parsedId);
      }
      changeNotifier.notify({ table: 'commitments', mutation: 'deleted' });
    },
  };
}

export type CommitmentData<TResultKind extends 'sync' | 'async'> = ReturnType<
  typeof createCommitmentData<TResultKind>
>;
