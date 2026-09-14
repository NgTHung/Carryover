/**
 * Read commitment status and its exact unpaid total from one database view.
 *
 * Management must remain available when the aggregate exceeds the safe VND
 * bound, so this read returns an overflow state while preserving every row.
 */
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import type { LedgerDatabase } from './atomic';
import {
  matchCommitmentReserves,
  summarizeUnpaidReserve,
  type CommitmentReserveMatch,
  type UnpaidReservePayment,
  type UnpaidReserveTotal,
} from './commitment-reserves';
import { resolveCommitmentDueDate } from './commitment-period';
import { categoryIdSchema, categoryKindSchema } from './category-validation';
import type { DateOnly } from './date-only';
import {
  commitmentDueDaySchema,
  commitmentIdSchema,
  commitmentSchema,
  type Commitment,
} from './commitment-validation';
import { positiveVndAmountSchema } from './money-validation';
import { periodBounds, type Period } from './period';
import { categories, commitments, transactions } from './schema';
import { transactionIdSchema } from './transaction-validation';

export type CommitmentOverviewLeaf = {
  id: string;
  name: string | null;
  groupName: string | null;
  active: boolean;
};

export type CommitmentOverviewItem = {
  commitment: Commitment;
  dueDate: DateOnly;
  leaf: CommitmentOverviewLeaf;
  state:
    | { status: 'inactive' }
    | { status: 'paid'; transactionId: string }
    | { status: 'unpaid'; nextToAcceptPayment: boolean };
};

export type CommitmentOverview = {
  period: Period;
  unpaidTotal: UnpaidReserveTotal;
  items: CommitmentOverviewItem[];
};

const storedDateSchema = z.number().int().transform((value) => new Date(value)).pipe(z.date());

const storedBooleanSchema = z.union([z.literal(0), z.literal(1)]).transform(
  (value) => value === 1
);

const commitmentPeriodReadRowSchema = z.union([
  z.tuple([
    z.literal('commitment'),
    commitmentIdSchema,
    z.string(),
    positiveVndAmountSchema,
    commitmentDueDaySchema,
    categoryIdSchema,
    storedBooleanSchema,
    storedDateSchema,
    storedDateSchema,
    z.null(),
    z.string().nullable(),
    storedDateSchema.nullable(),
    categoryKindSchema.nullable(),
    categoryIdSchema.nullable(),
    z.string().nullable(),
    storedDateSchema.nullable(),
    categoryKindSchema.nullable(),
    categoryIdSchema.nullable(),
  ]),
  z.tuple([
    z.literal('payment'),
    transactionIdSchema,
    z.null(),
    z.null(),
    z.null(),
    categoryIdSchema,
    z.null(),
    z.null(),
    z.null(),
    storedDateSchema,
    z.null(),
    z.null(),
    z.null(),
    z.null(),
    z.null(),
    z.null(),
    z.null(),
    z.null(),
  ]),
]);

type CommitmentPeriodItem = Omit<CommitmentOverviewItem, 'state'>;

export type CommitmentPeriodInputs = {
  commitments: CommitmentPeriodItem[];
  matches: CommitmentReserveMatch[];
  unpaidTotal: UnpaidReserveTotal;
};

function compareOverviewItems(
  left: CommitmentPeriodItem,
  right: CommitmentPeriodItem
): number {
  return (
    left.commitment.dueDay - right.commitment.dueDay ||
    left.commitment.name.localeCompare(right.commitment.name) ||
    left.commitment.id.localeCompare(right.commitment.id)
  );
}

function leafIsActive(row: Extract<
  z.infer<typeof commitmentPeriodReadRowSchema>,
  ['commitment', ...unknown[]]
>): boolean {
  return (
    row[10] !== null &&
    row[11] === null &&
    row[12] === 'reserve' &&
    row[13] !== null &&
    row[14] !== null &&
    row[15] === null &&
    row[16] === 'reserve' &&
    row[17] === null
  );
}

export async function readCommitmentPeriodInputs<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  period: Period
): Promise<CommitmentPeriodInputs> {
  const bounds = periodBounds(period);
  const rawRows = await db.values(sql`
    SELECT
      'commitment',
      ${commitments.id},
      ${commitments.name},
      ${commitments.amount},
      ${commitments.dueDay},
      ${commitments.categoryId},
      ${commitments.active},
      ${commitments.createdAt},
      ${commitments.updatedAt},
      NULL,
      leaf.name,
      leaf.deleted_at,
      leaf.kind,
      leaf.parent_id,
      parent.name,
      parent.deleted_at,
      parent.kind,
      parent.parent_id
    FROM ${commitments}
    LEFT JOIN ${categories} AS leaf ON leaf.id = ${commitments.categoryId}
    LEFT JOIN ${categories} AS parent ON parent.id = leaf.parent_id
    WHERE ${commitments.deletedAt} IS NULL
    UNION ALL
    SELECT
      'payment',
      ${transactions.id},
      NULL,
      NULL,
      NULL,
      ${transactions.categoryId},
      NULL,
      NULL,
      NULL,
      ${transactions.occurredAt},
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL
    FROM ${transactions}
    WHERE ${transactions.status} = 'complete'
      AND ${transactions.direction} = 'expense'
      AND ${transactions.categoryId} IS NOT NULL
      AND ${transactions.occurredAt} >= ${bounds.start.getTime()}
      AND ${transactions.occurredAt} < ${bounds.end.getTime()}
      AND ${transactions.deletedAt} IS NULL
  `);

  const periodCommitments: CommitmentPeriodItem[] = [];
  const payments: UnpaidReservePayment[] = [];
  for (const rawRow of rawRows) {
    const row = commitmentPeriodReadRowSchema.parse(rawRow);
    if (row[0] === 'payment') {
      payments.push({ id: row[1], categoryId: row[5], occurredAt: row[9] });
      continue;
    }

    const commitment = commitmentSchema.parse({
      id: row[1],
      name: row[2],
      amount: row[3],
      dueDay: row[4],
      categoryId: row[5],
      active: row[6],
      createdAt: row[7],
      updatedAt: row[8],
      deletedAt: null,
    });
    periodCommitments.push({
      commitment,
      dueDate: resolveCommitmentDueDate(period, commitment.dueDay),
      leaf: {
        id: commitment.categoryId,
        name: row[10],
        groupName: row[14],
        active: leafIsActive(row),
      },
    });
  }

  const matches = matchCommitmentReserves(
    periodCommitments
      .filter(({ commitment }) => commitment.active)
      .map(({ commitment, dueDate }) => ({
        id: commitment.id,
        amount: commitment.amount,
        categoryId: commitment.categoryId,
        dueDate,
      })),
    payments
  );
  return {
    commitments: periodCommitments.sort(compareOverviewItems),
    matches,
    unpaidTotal: summarizeUnpaidReserve(matches),
  };
}
