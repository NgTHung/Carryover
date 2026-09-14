/**
 * Opens the current local period before a snapshot or mutation reads it.
 *
 * A period's opening balance is the active account balance immediately before
 * its first local day. The current income total is then derived from active
 * known income in that period. Both values are computed from one transaction,
 * while existing opening, reserve, and horizon snapshots remain untouched.
 */
import { and, eq } from 'drizzle-orm';

import { deriveAccountBalances, type BalanceTransaction } from './account-balances';
import {
  createDefaultAtomicRunner,
  type AtomicTransactionRunner,
  type LedgerDatabase,
} from './atomic';
import {
  accounts as accountsTable,
  commitments,
  monthConfig,
  transactions,
  transfers,
} from './schema';
import { activeRowFilter } from './soft-delete';
import { currentPeriod, periodBounds, periodEndDate, type Period } from './period';
import { monthConfigSchema, type MonthConfig } from './month-config-validation';
import { sumKnownIncome, sumNonNegativeVnd, safeSignedVnd, type IncomeRow } from './period-income';
import {
  ledgerChangeNotifier,
  type LedgerChangeNotifier,
} from './ledger-change-notifier';

type AccountPreparationRow = {
  accountId: string;
  openingBalance: number;
  deletedAt: Date | null;
};

type TransactionPreparationRow = {
  accountId: string;
  direction: 'expense' | 'income' | 'adjustment' | 'transfer';
  amount: number | null;
  adjustmentEffect: 'increase' | 'decrease' | null;
  payerContactId: string | null;
  occurredAt: Date;
};

type TransferPreparationRow = {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  occurredAt: Date;
};

type CommitmentPreparationRow = { amount: number };

export type PeriodPreparationMutation = 'created' | 'edited' | 'none';

export type PeriodPreparationResult = {
  config: MonthConfig;
  mutation: PeriodPreparationMutation;
};

function toMonthConfig(row: typeof monthConfig.$inferSelect): MonthConfig {
  return monthConfigSchema.parse({
    period: row.period,
    openingBalance: row.openingBalance,
    incomeTotal: row.incomeTotal,
    reservedTotal: row.reservedTotal,
    horizonDate: row.horizonDate,
  });
}

function balanceTransaction(row: TransactionPreparationRow): BalanceTransaction {
  const base = { accountId: row.accountId, amount: row.amount };
  if (row.direction === 'expense') {
    return { ...base, direction: row.direction, payerContactId: row.payerContactId };
  }
  if (row.direction === 'adjustment') {
    return { ...base, direction: row.direction, adjustmentEffect: row.adjustmentEffect };
  }
  return { ...base, direction: row.direction };
}

function deriveOpeningBalance(
  period: Period,
  accounts: readonly AccountPreparationRow[],
  transactionRows: readonly TransactionPreparationRow[],
  transferRows: readonly TransferPreparationRow[]
): number {
  const boundary = periodBounds(period).start;
  const derived = deriveAccountBalances({
    accounts: accounts.map(({ accountId, openingBalance }) => ({ accountId, openingBalance })),
    transactions: transactionRows
      .filter(({ occurredAt }) => occurredAt < boundary)
      .map(balanceTransaction),
    transfers: transferRows
      .filter(({ occurredAt }) => occurredAt < boundary)
      .map(({ fromAccountId, toAccountId, amount }) => ({ fromAccountId, toAccountId, amount })),
  });
  const activeAccountIds = new Set(
    accounts.filter(({ deletedAt }) => deletedAt === null).map(({ accountId }) => accountId)
  );
  const total = derived
    .filter(({ accountId }) => activeAccountIds.has(accountId))
    .reduce((sum, { balance }) => sum + BigInt(balance), 0n);
  return safeSignedVnd(total, `opening balance for ${period}`);
}

async function readPreparationRows(
  db: LedgerDatabase<'sync' | 'async'>
): Promise<{
  accounts: AccountPreparationRow[];
  transactions: TransactionPreparationRow[];
  transfers: TransferPreparationRow[];
  commitments: CommitmentPreparationRow[];
}> {
  const accountRows = await db
    .select({
      accountId: accountsTable.id,
      openingBalance: accountsTable.openingBalance,
      deletedAt: accountsTable.deletedAt,
    })
    .from(accountsTable)
    .all() as AccountPreparationRow[];
  const transactionRows = await db
    .select({
      accountId: transactions.accountId,
      direction: transactions.direction,
      amount: transactions.amount,
      adjustmentEffect: transactions.adjustmentEffect,
      payerContactId: transactions.payerContactId,
      occurredAt: transactions.occurredAt,
    })
    .from(transactions)
    .where(activeRowFilter(transactions.deletedAt))
    .all() as TransactionPreparationRow[];
  const transferRows = await db
    .select({
      fromAccountId: transfers.fromAccountId,
      toAccountId: transfers.toAccountId,
      amount: transfers.amount,
      occurredAt: transfers.occurredAt,
    })
    .from(transfers)
    .where(activeRowFilter(transfers.deletedAt))
    .all() as TransferPreparationRow[];
  const commitmentRows = await db
    .select({ amount: commitments.amount })
    .from(commitments)
    .where(
      and(eq(commitments.active, true), activeRowFilter(commitments.deletedAt))
    )
    .all() as CommitmentPreparationRow[];
  return {
    accounts: accountRows,
    transactions: transactionRows,
    transfers: transferRows,
    commitments: commitmentRows,
  };
}

function readIncomeRows(rows: readonly TransactionPreparationRow[]): IncomeRow[] {
  return rows.map(({ direction, amount, occurredAt }) => ({ direction, amount, occurredAt }));
}

function updatedAtAfter(previous: Date, at: Date): Date {
  return new Date(Math.max(at.getTime(), previous.getTime() + 1));
}

async function readStoredConfig(
  db: LedgerDatabase<'sync' | 'async'>,
  period: Period
): Promise<typeof monthConfig.$inferSelect | undefined> {
  return db
    .select()
    .from(monthConfig)
    .where(and(eq(monthConfig.period, period), activeRowFilter(monthConfig.deletedAt)))
    .get() as typeof monthConfig.$inferSelect | undefined;
}

export async function prepareCurrentPeriodInTransaction(
  db: LedgerDatabase<'sync' | 'async'>,
  now: Date
): Promise<PeriodPreparationResult> {
  const period = currentPeriod(now);
  const existingRow = await readStoredConfig(db, period);
  const rows = await readPreparationRows(db);
  const incomeTotal = sumKnownIncome(readIncomeRows(rows.transactions), period);

  if (existingRow === undefined) {
    const inserted = await db
      .insert(monthConfig)
      .values({
        period,
        openingBalance: deriveOpeningBalance(
          period,
          rows.accounts,
          rows.transactions,
          rows.transfers
        ),
        incomeTotal,
        reservedTotal: sumNonNegativeVnd(
          rows.commitments.map(({ amount }) => amount),
          'reserved total'
        ),
        horizonDate: periodEndDate(period),
      })
      .onConflictDoNothing({ target: monthConfig.period })
      .returning()
      .get();
    if (inserted !== undefined) {
      return { config: toMonthConfig(inserted), mutation: 'created' };
    }
    const concurrent = await readStoredConfig(db, period);
    if (concurrent === undefined) {
      throw new Error(`Active month config for period ${period} was not found after opening`);
    }
    return { config: toMonthConfig(concurrent), mutation: 'none' };
  }

  const existing = toMonthConfig(existingRow);
  if (existing.incomeTotal === incomeTotal) {
    return { config: existing, mutation: 'none' };
  }
  const updated = await db
    .update(monthConfig)
    .set({ incomeTotal, updatedAt: updatedAtAfter(existingRow.updatedAt, now) })
    .where(
      and(
        eq(monthConfig.period, period),
        eq(monthConfig.updatedAt, existingRow.updatedAt),
        activeRowFilter(monthConfig.deletedAt)
      )
    )
    .returning()
    .get();
  if (updated === undefined) {
    throw new Error(`Month config for period ${period} changed during preparation`);
  }
  return { config: toMonthConfig(updated), mutation: 'edited' };
}

export async function refreshCurrentPeriodIncomeInTransaction(
  db: LedgerDatabase<'sync' | 'async'>,
  period: Period,
  now: Date = new Date(),
): Promise<PeriodPreparationMutation> {
  const existingRow = await readStoredConfig(db, period);
  if (existingRow === undefined) {
    throw new Error(`Active month config for period ${period} was not found`);
  }
  const rows = (await readPreparationRows(db)).transactions;
  const incomeTotal = sumKnownIncome(readIncomeRows(rows), period);
  if (existingRow.incomeTotal === incomeTotal) return 'none';
  const updated = await db
    .update(monthConfig)
    .set({ incomeTotal, updatedAt: updatedAtAfter(existingRow.updatedAt, now) })
    .where(
      and(
        eq(monthConfig.period, period),
        eq(monthConfig.updatedAt, existingRow.updatedAt),
        activeRowFilter(monthConfig.deletedAt)
      )
    )
    .returning()
    .get();
  if (updated === undefined) {
    throw new Error(`Month config for period ${period} changed during income maintenance`);
  }
  return 'edited';
}

export function createPeriodPreparationData<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  options: {
    runAtomic?: AtomicTransactionRunner<TResultKind>;
    now?: () => Date;
    changeNotifier?: LedgerChangeNotifier;
  } = {}
) {
  const runAtomic = options.runAtomic ?? createDefaultAtomicRunner(db);
  const now = options.now ?? (() => new Date());
  const changeNotifier = options.changeNotifier ?? ledgerChangeNotifier;

  return {
    async prepareCurrentPeriod(at: Date = now()): Promise<MonthConfig> {
      const result = await runAtomic((transactionDb) =>
        prepareCurrentPeriodInTransaction(transactionDb, at)
      );
      if (result.mutation !== 'none') {
        changeNotifier.notify({
          table: 'month_config',
          mutation: result.mutation === 'created' ? 'created' : 'edited',
        });
      }
      return result.config;
    },
  };
}

export type PeriodPreparationData<TResultKind extends 'sync' | 'async'> = ReturnType<
  typeof createPeriodPreparationData<TResultKind>
>;
