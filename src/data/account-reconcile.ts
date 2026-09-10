/**
 * Atomically reconciles one account against a stated balance.
 *
 * Expo's Drizzle driver uses synchronous transactions while tests use an
 * asynchronous proxy. One INSERT from a balance projection gives both drivers
 * the same atomic write without an unsafe asynchronous transaction callback.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { alias } from 'drizzle-orm/sqlite-core';

import { MAX_VND_AMOUNT } from '../money/currency';
import {
  reconcileAccountSchema,
  type AdjustmentEffect,
} from './account-validation';
import type { LedgerChangeNotifier } from './ledger-change-notifier';
import { activeRowFilter } from './soft-delete';
import {
  accounts,
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

export type ReconcileResult =
  | {
      status: 'unchanged';
      accountId: string;
      balance: number;
    }
  | {
      status: 'adjusted';
      accountId: string;
      balance: number;
      adjustmentId: string;
      adjustmentAmount: number;
      adjustmentEffect: AdjustmentEffect;
    };

function accountNotFound(accountId: string): Error {
  return new Error(`Active account ${accountId} was not found`);
}

function reconcileConflict(accountId: string): Error {
  return new Error(`Account ${accountId} changed during reconcile`);
}

const currentBalanceSql = () => {
  const maxBalance = sql.raw(MAX_VND_AMOUNT.toString());
  const transactionEffect = sql`
    COALESCE((
      SELECT SUM(
        CASE
          WHEN t.amount IS NULL THEN 0
          WHEN t.direction = 'income' THEN t.amount
          WHEN t.direction = 'expense' AND t.payer_contact_id IS NULL THEN -t.amount
          WHEN t.direction = 'adjustment' AND t.adjustment_effect = 'increase' THEN t.amount
          WHEN t.direction = 'adjustment' AND t.adjustment_effect = 'decrease' THEN -t.amount
          ELSE 0
        END
      )
      FROM transactions AS t
      WHERE t.account_id = a.id
        AND t.deleted_at IS NULL
    ), 0)
  `;
  const transferEffect = sql`
    COALESCE((
      SELECT SUM(
        CASE
          WHEN tr.from_account_id = a.id THEN -tr.amount
          WHEN tr.to_account_id = a.id THEN tr.amount
          ELSE 0
        END
      )
      FROM transfers AS tr
      WHERE tr.deleted_at IS NULL
        AND (tr.from_account_id = a.id OR tr.to_account_id = a.id)
    ), 0)
  `;
  return sql<number | null>`
    CASE
      WHEN a.opening_balance + (${transactionEffect}) + (${transferEffect})
        BETWEEN -${maxBalance} AND ${maxBalance}
      THEN a.opening_balance + (${transactionEffect}) + (${transferEffect})
      ELSE NULL
    END
  `;
};

function reconcileInsert<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  accountId: string,
  statedBalance: number,
  occurredAt: Date
) {
  const balance = currentBalanceSql();
  const maxBalance = sql.raw(MAX_VND_AMOUNT.toString());
  return db
    .insert(transactions)
    .select(sql`
      SELECT
        ${uuidV4Sql},
        ${nowMillisecondsSql()},
        ${nowMillisecondsSql()},
        NULL,
        a.id,
        'adjustment',
        CASE WHEN ${statedBalance} > (${balance})
          THEN 'increase'
          ELSE 'decrease'
        END,
        CASE WHEN ${statedBalance} > (${balance})
          THEN ${statedBalance} - (${balance})
          ELSE (${balance}) - ${statedBalance}
        END,
        NULL,
        NULL,
        NULL,
        ${occurredAt.getTime()},
        'complete',
        NULL,
        NULL,
        NULL
      FROM accounts AS a
      WHERE a.id = ${accountId}
        AND a.deleted_at IS NULL
        AND ${statedBalance} <> (${balance})
        AND (${balance}) BETWEEN -${maxBalance} AND ${maxBalance}
        AND CASE WHEN ${statedBalance} > (${balance})
          THEN ${statedBalance} - (${balance})
          ELSE (${balance}) - ${statedBalance}
        END BETWEEN 1 AND ${maxBalance}
    `)
    .returning()
    .get();
}

function readProjectedAccount<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  accountId: string
) {
  const account = alias(accounts, 'a');
  return db
    .select({
      accountId: account.id,
      balance: currentBalanceSql(),
    })
    .from(account)
    .where(
      and(
        eq(account.id, accountId),
        activeRowFilter(account.deletedAt)
      )
    )
    .get();
}

export async function reconcileAccount<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  changeNotifier: LedgerChangeNotifier,
  input: unknown
): Promise<ReconcileResult> {
  const parsed = reconcileAccountSchema.parse(input);
  const inserted = await reconcileInsert(
    db,
    parsed.accountId,
    parsed.statedBalance,
    parsed.occurredAt
  );
  if (inserted !== undefined) {
    if (inserted.amount === null || inserted.adjustmentEffect === null) {
      throw reconcileConflict(parsed.accountId);
    }
    changeNotifier.notify({ table: 'transactions', mutation: 'created' });
    return {
      status: 'adjusted',
      accountId: parsed.accountId,
      balance: parsed.statedBalance,
      adjustmentId: inserted.id,
      adjustmentAmount: inserted.amount,
      adjustmentEffect: inserted.adjustmentEffect,
    };
  }

  const account = await readProjectedAccount(db, parsed.accountId);
  if (account === undefined) {
    throw accountNotFound(parsed.accountId);
  }
  if (account.balance === null) {
    throw new RangeError('Account balance exceeds the safe VND range');
  }
  if (account.balance !== parsed.statedBalance) {
    const delta = BigInt(parsed.statedBalance) - BigInt(account.balance);
    if (
      delta < -BigInt(MAX_VND_AMOUNT) ||
      delta > BigInt(MAX_VND_AMOUNT)
    ) {
      throw new RangeError('Reconcile delta exceeds the safe VND amount');
    }
    throw reconcileConflict(parsed.accountId);
  }
  return {
    status: 'unchanged',
    accountId: parsed.accountId,
    balance: account.balance,
  };
}
