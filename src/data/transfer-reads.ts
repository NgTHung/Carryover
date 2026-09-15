/**
 * Read models for dedicated transfers.
 *
 * The list and detail screens need the same account-label resolution. Account
 * labels intentionally do not use the active-row filter, so a surviving
 * transfer keeps the names of accounts that were later soft-deleted.
 */
import {
  and,
  eq,
  gte,
  lt,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

import { ledgerTables, transfers } from './schema';
import { activeRowFilter } from './soft-delete';

type LedgerDatabase<TResultKind extends 'sync' | 'async'> = BaseSQLiteDatabase<
  TResultKind,
  unknown,
  typeof ledgerTables
>;

export type AccountLabel = {
  id: string;
  name: string;
  kind: 'bank' | 'cash';
};

export type TransferLabel = {
  id: string;
  amount: number;
  occurredAt: Date;
  createdAt: Date;
};

export type TransferRead = {
  transfer: TransferLabel;
  fromAccount: AccountLabel;
  toAccount: AccountLabel;
};

export type TransactionListTableTransferRow = TransferRead & {
  kind: 'transfer';
  source: 'transfers';
};

export const transferIdSchema = z.string().uuid();

export type DedicatedTransferListOptions = {
  start: Date;
  end: Date;
  accountId: string | null;
  include: boolean;
};

function accountLabel(row: { id: string; name: string; kind: 'bank' | 'cash' }): AccountLabel {
  return { id: row.id, name: row.name, kind: row.kind };
}

function transferPredicates(options: DedicatedTransferListOptions): SQL[] {
  const predicates: Array<SQL | undefined> = [
    activeRowFilter(transfers.deletedAt),
    gte(transfers.occurredAt, options.start),
    lt(transfers.occurredAt, options.end),
  ];
  if (options.accountId !== null) {
    predicates.push(
      or(
        eq(transfers.fromAccountId, options.accountId),
        eq(transfers.toAccountId, options.accountId)
      )
    );
  }
  return predicates.filter((predicate): predicate is SQL => predicate !== undefined);
}

function transferSelection() {
  return {
    transfer: {
      id: transfers.id,
      amount: transfers.amount,
      occurredAt: transfers.occurredAt,
      createdAt: transfers.createdAt,
    },
    fromAccount: {
      id: transfers.fromAccountId,
      name: sql<string>`(
        SELECT name FROM accounts
        WHERE accounts.id = ${transfers.fromAccountId}
      )`,
      kind: sql<'bank' | 'cash'>`(
        SELECT kind FROM accounts
        WHERE accounts.id = ${transfers.fromAccountId}
      )`,
    },
    toAccount: {
      id: transfers.toAccountId,
      name: sql<string>`(
        SELECT name FROM accounts
        WHERE accounts.id = ${transfers.toAccountId}
      )`,
      kind: sql<'bank' | 'cash'>`(
        SELECT kind FROM accounts
        WHERE accounts.id = ${transfers.toAccountId}
      )`,
    },
  };
}

function toTransferRead(row: {
  transfer: TransferLabel;
  fromAccount: { id: string; name: string; kind: 'bank' | 'cash' };
  toAccount: { id: string; name: string; kind: 'bank' | 'cash' };
}): TransferRead {
  return {
    transfer: row.transfer,
    fromAccount: accountLabel(row.fromAccount),
    toAccount: accountLabel(row.toAccount),
  };
}

export async function readDedicatedTransfers<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  options: DedicatedTransferListOptions
): Promise<TransactionListTableTransferRow[]> {
  if (!options.include) return [];
  const rows = await db
    .select(transferSelection())
    .from(transfers)
    .where(and(...transferPredicates(options)))
    .all();
  return rows.map((row) => ({
    kind: 'transfer' as const,
    source: 'transfers' as const,
    ...toTransferRead(row),
  }));
}

export async function readTransfer<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  input: unknown
): Promise<TransferRead | undefined> {
  const transferId = transferIdSchema.parse(input);
  const row = await db
    .select(transferSelection())
    .from(transfers)
    .where(
      and(
        eq(transfers.id, transferId),
        activeRowFilter(transfers.deletedAt)
      )
    )
    .get();
  return row === undefined ? undefined : toTransferRead(row);
}

export type { LedgerDatabase };
