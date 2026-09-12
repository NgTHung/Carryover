/**
 * Computes the day-level report used by the period pace line and calendar.
 *
 * The input is already shaped like a period summary, but the history engine
 * owns the second aggregation: daily own spending, income marks, and the
 * point-by-point median of complete reference periods. It never reads the
 * clock or SQLite. BigInt keeps money exact until values cross the report
 * boundary, and computeBudget remains the only budget arithmetic function.
 */
import { computeBudget } from '../budget/compute-budget';
import { dateOnlySchema, type DateOnly } from '../data/date-only';
import {
  formatPeriod,
  periodDayCount,
  periodDayDate,
  periodSchema,
  type Period,
} from '../data/period';
import {
  monthConfigSchema,
  type MonthConfig,
} from '../data/month-config-validation';
import {
  assertPositiveVndAmount,
  MAX_VND_AMOUNT,
} from '../money/currency';
import {
  ownExpenseAmount,
  resolveOwnShareAmounts,
  type OwnExpenseShare,
} from '../money/own-expense';
import {
  transactionQualitySchema,
} from '../data/transaction-validation';
import type { MonthSummaryInput, MonthSummaryTransaction } from './month-summary';
import type {
  HistoryTransaction,
  PeriodHistory,
  PeriodHistoryDay,
  PeriodHistoryGap,
  PeriodHistoryInput,
  PeriodHistoryPoint,
  PeriodHistoryReference,
  SpendStep,
} from './period-history-types';

export type {
  HistoryTransaction,
  PeriodHistory,
  PeriodHistoryDay,
  PeriodHistoryGap,
  PeriodHistoryInput,
  PeriodHistoryPoint,
  PeriodHistoryReference,
  SpendStep,
} from './period-history-types';

const MAX_SAFE_INTEGER_BIGINT = BigInt(MAX_VND_AMOUNT);

type DayAccumulator = {
  spend: bigint;
  income: bigint;
  unknownDrafts: number;
  transactions: HistoryTransaction[];
};

type ValidatedPeriod = {
  period: Period;
  monthConfig: MonthConfig;
  transactions: readonly MonthSummaryTransaction[];
  shares: readonly OwnExpenseShare[];
};

function toSafeNumber(value: bigint, field: string): number {
  if (value < 0n || value > MAX_SAFE_INTEGER_BIGINT) {
    throw new RangeError(`${field} exceeds the safe integer range`);
  }
  return Number(value);
}

function validateTransaction(
  transaction: MonthSummaryTransaction,
  period: Period
): void {
  dateOnlySchema.parse(transaction.occurredOn);
  if (transaction.occurredOn.slice(0, 7) !== period) {
    throw new RangeError(
      `Transaction ${transaction.id} does not belong to period ${period}`
    );
  }
  if (transaction.status === 'complete' && transaction.amount === null) {
    throw new TypeError(`Complete transaction ${transaction.id} has no amount`);
  }
  if (transaction.amount !== null) {
    assertPositiveVndAmount(transaction.amount, `transaction ${transaction.id} amount`);
  }
  if (transaction.quality !== null) {
    transactionQualitySchema.parse(transaction.quality);
  }
}

function validatePeriod(input: MonthSummaryInput): ValidatedPeriod {
  const period = periodSchema.parse(input.period);
  const monthConfig = monthConfigSchema.parse(input.monthConfig);
  if (monthConfig.period !== period) {
    throw new RangeError(
      `Month config ${monthConfig.period} does not match period ${period}`
    );
  }

  const ids = new Set<string>();
  for (const transaction of input.transactions) {
    if (ids.has(transaction.id)) {
      throw new Error(`Duplicate report transaction ${transaction.id}`);
    }
    ids.add(transaction.id);
    validateTransaction(transaction, period);
  }

  return {
    period,
    monthConfig,
    transactions: input.transactions,
    shares: input.shares,
  };
}

function emptyDay(): DayAccumulator {
  return {
    spend: 0n,
    income: 0n,
    unknownDrafts: 0,
    transactions: [],
  };
}

function transactionLabel(transaction: MonthSummaryTransaction): string {
  if (transaction.direction === 'income') return 'Income';
  return transaction.leaf?.name ?? transaction.group?.name ?? 'No leaf category';
}

function toHistoryTransaction(
  transaction: MonthSummaryTransaction,
  amount: number | null
): HistoryTransaction | null {
  if (transaction.direction !== 'expense' && transaction.direction !== 'income') {
    return null;
  }
  return {
    id: transaction.id,
    direction: transaction.direction,
    status: transaction.status,
    amount,
    label: transactionLabel(transaction),
  };
}

function periodCutoffDay(period: Period, today: DateOnly): number {
  const todayPeriod = today.slice(0, 7) as Period;
  if (period < todayPeriod) return periodDayCount(period);
  if (period > todayPeriod) return 0;
  return Number(today.slice(8, 10));
}

function historicalSpendByDay(
  period: ValidatedPeriod,
  ownShareByTransaction: ReadonlyMap<string, bigint>
): bigint[] {
  const spendByDay = Array.from({ length: periodDayCount(period.period) }, () => 0n);
  for (const transaction of period.transactions) {
    if (transaction.direction !== 'expense' || transaction.amount === null) continue;
    const day = Number(transaction.occurredOn.slice(8, 10));
    spendByDay[day - 1] += ownExpenseAmount(transaction, ownShareByTransaction);
  }
  return spendByDay;
}

function cumulativePoints(spendByDay: readonly bigint[]): bigint[] {
  let cumulative = 0n;
  return spendByDay.map((amount) => {
    cumulative += amount;
    return cumulative;
  });
}

function median(values: readonly bigint[]): bigint {
  if (values.length === 0) {
    throw new Error('Cannot compute a median without values');
  }
  const sorted = [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0n;
  return ((sorted[middle - 1] ?? 0n) + (sorted[middle] ?? 0n)) / 2n;
}

function spendStep(spend: bigint, perDay: number | null): SpendStep {
  if (spend === 0n) return 0;
  if (perDay === null || perDay <= 0) return 4;
  const threshold = BigInt(perDay);
  if (spend * 2n <= threshold) return 1;
  if (spend <= threshold) return 2;
  if (spend <= threshold * 2n) return 3;
  return 4;
}

function frozenPerDay(monthConfig: MonthConfig): number | null {
  return computeBudget({
    today: periodDayDate(monthConfig.period, 1),
    updatedAt: new Date(0).toISOString(),
    monthConfig: {
      period: monthConfig.period,
      horizonDate: monthConfig.horizonDate,
    },
    accountBalances: [monthConfig.openingBalance, monthConfig.incomeTotal],
    reservedUnpaid: monthConfig.reservedTotal,
    transactions: [],
    shares: [],
    owedToYou: 0,
  }).perDay;
}

function addTransactionToDay(
  accumulator: DayAccumulator,
  transaction: MonthSummaryTransaction,
  ownShareByTransaction: ReadonlyMap<string, bigint>
): void {
  if (transaction.direction === 'expense') {
    if (transaction.status === 'draft' && transaction.amount === null) {
      accumulator.unknownDrafts += 1;
      const detail = toHistoryTransaction(transaction, null);
      if (detail !== null) accumulator.transactions.push(detail);
      return;
    }
    const amount = ownExpenseAmount(transaction, ownShareByTransaction);
    accumulator.spend += amount;
    const detail = toHistoryTransaction(transaction, toSafeNumber(amount, `transaction ${transaction.id} own share`));
    if (detail !== null) accumulator.transactions.push(detail);
    return;
  }

  if (transaction.direction === 'income' && transaction.amount !== null) {
    const amount = BigInt(transaction.amount);
    accumulator.income += amount;
    const detail = toHistoryTransaction(transaction, transaction.amount);
    if (detail !== null) accumulator.transactions.push(detail);
  }
}

function periodDayAccumulators(
  period: ValidatedPeriod,
  cutoffDay: number,
  ownShareByTransaction: ReadonlyMap<string, bigint>
): DayAccumulator[] {
  const accumulators = Array.from(
    { length: periodDayCount(period.period) },
    emptyDay
  );
  for (const transaction of period.transactions) {
    const day = Number(transaction.occurredOn.slice(8, 10));
    if (day > cutoffDay) continue;
    const accumulator = accumulators[day - 1];
    if (accumulator !== undefined) {
      addTransactionToDay(accumulator, transaction, ownShareByTransaction);
    }
  }
  for (const accumulator of accumulators) {
    accumulator.transactions.sort((left, right) => left.id.localeCompare(right.id));
  }
  return accumulators;
}

function referenceLabel(periods: readonly ValidatedPeriod[]): string {
  if (periods.length === 1) {
    const period = periods[0];
    if (period === undefined) throw new Error('Reference period is missing');
    return formatPeriod(period.period);
  }
  if (periods.length === 2) return '2-period median';
  return 'usual';
}

export function computePeriodHistory(input: PeriodHistoryInput): PeriodHistory {
  const today = dateOnlySchema.parse(input.today);
  const current = validatePeriod(input.current);
  const references = input.references
    .map(validatePeriod)
    .filter(
      (period) =>
        period.period < current.period && period.period < today.slice(0, 7)
    )
    .sort((left, right) => left.period.localeCompare(right.period));

  const cutoffDay = periodCutoffDay(current.period, today);
  const perDay = frozenPerDay(current.monthConfig);
  const ownShareByTransaction = resolveOwnShareAmounts(
    current.transactions,
    current.shares
  );
  const dayAccumulators = periodDayAccumulators(
    current,
    cutoffDay,
    ownShareByTransaction
  );

  const currentSpendByDay = dayAccumulators.map((day) => day.spend);
  const actualCumulative = cumulativePoints(currentSpendByDay.slice(0, cutoffDay));
  const actualPoints = actualCumulative.map((amount, index) => ({
    day: index + 1,
    amount: toSafeNumber(amount, 'actual cumulative spending'),
  }));

  const referenceCumulative = references.map((period) =>
    cumulativePoints(
      historicalSpendByDay(
        period,
        resolveOwnShareAmounts(period.transactions, period.shares)
      )
    )
  );
  const referencePoints =
    references.length === 0
      ? []
      : Array.from({ length: periodDayCount(current.period) }, (_, index) => {
          const day = index + 1;
          const amounts = referenceCumulative.map((points, referenceIndex) => {
            const referencePeriod = references[referenceIndex];
            const referenceDay = Math.min(day, periodDayCount(referencePeriod?.period ?? current.period));
            return points[referenceDay - 1] ?? 0n;
          });
          return {
            day,
            amount: toSafeNumber(median(amounts), `median spending at day ${day}`),
          };
        });

  const reference: PeriodHistoryReference =
    references.length === 0
      ? { status: 'none' }
      : {
          status: 'available',
          label: referenceLabel(references),
          sampleCount: references.length,
          points: referencePoints,
        };

  const referenceAtCutoff =
    reference.status === 'available'
      ? reference.points[Math.max(cutoffDay - 1, 0)]?.amount ?? 0
      : null;
  const actualAtCutoff = actualCumulative[actualCumulative.length - 1] ?? 0n;
  const referenceAtCutoffBigInt =
    referenceAtCutoff === null ? null : BigInt(referenceAtCutoff);
  const gap =
    referenceAtCutoffBigInt === null || cutoffDay === 0
      ? null
      : {
          relation:
            actualAtCutoff > referenceAtCutoffBigInt
              ? ('above' as const)
              : actualAtCutoff < referenceAtCutoffBigInt
                ? ('below' as const)
                : ('equal' as const),
          amount: toSafeNumber(
            actualAtCutoff >= referenceAtCutoffBigInt
              ? actualAtCutoff - referenceAtCutoffBigInt
              : referenceAtCutoffBigInt - actualAtCutoff,
            'pace gap'
          ),
          day: cutoffDay,
        };

  const currentPeriodName = today.slice(0, 7);
  const days = dayAccumulators.map((day, index) => {
    const dayNumber = index + 1;
    const phase =
      current.period === currentPeriodName && dayNumber === cutoffDay
        ? 'today'
        : dayNumber <= cutoffDay
          ? 'elapsed'
          : 'future';
    return {
      date: periodDayDate(current.period, dayNumber),
      day: dayNumber,
      phase,
      spend: toSafeNumber(day.spend, `spending on day ${dayNumber}`),
      income: toSafeNumber(day.income, `income on day ${dayNumber}`),
      spendStep: spendStep(day.spend, perDay),
      unknownDrafts: day.unknownDrafts,
      transactions: day.transactions,
    } satisfies PeriodHistoryDay;
  });

  return {
    perDay,
    cutoffDay,
    actualPoints,
    reference,
    gap,
    days,
  };
}
