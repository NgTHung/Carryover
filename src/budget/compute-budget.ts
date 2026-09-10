/**
 * Pure budget arithmetic for the phone and widget snapshot.
 *
 * The caller supplies normalized, active ledger rows and the stored period
 * horizon. This module owns every money total and every division so a second
 * surface cannot quietly choose different rounding or split behavior.
 */
import {
  assertNonNegativeVndAmount,
  assertPositiveVndAmount,
  assertVndInteger,
  MAX_VND_AMOUNT,
} from '../money/currency';
import { dateOnlySchema, type DateOnly } from '../data/date-only';
import type { Payer } from '../data/payer';
import type { Period } from '../data/period';
import type { TransactionQuality } from '../data/transaction-validation';
import type { BudgetSnapshot } from './snapshot';

const DAYS_IN_BURN_WINDOW = 30;
const MAX_SAFE_INTEGER_BIGINT = BigInt(MAX_VND_AMOUNT);
const MILLIS_PER_DAY = 86_400_000;

type BudgetTransactionBase = {
  id: string;
  direction: 'expense' | 'income' | 'adjustment' | 'transfer';
  payer: Payer;
  quality: TransactionQuality | null;
  occurredOn: DateOnly;
};

export type BudgetTransaction =
  | (BudgetTransactionBase & {
      status: 'draft';
      amount: number | null;
    })
  | (BudgetTransactionBase & {
      status: 'complete';
      amount: number;
    });

export type BudgetShare = {
  transactionId: string;
  contactId: string | null;
  shareAmount: number;
};

export type BudgetInput = {
  today: DateOnly;
  updatedAt: string;
  monthConfig: {
    period: Period;
    horizonDate: DateOnly;
  };
  /** The caller supplies balances for active bank and cash accounts only. */
  accountBalances: readonly number[];
  reservedUnpaid: number;
  /** Rows are active and validated before they cross the pure boundary. */
  transactions: readonly BudgetTransaction[];
  shares: readonly BudgetShare[];
  /** The debt ledger nets settlements before supplying this receivable. */
  owedToYou: number;
};

type ValidatedBudgetInput = BudgetInput & {
  todayDay: number;
  horizonDay: number;
  ownShareByTransaction: ReadonlyMap<string, bigint>;
};

function toSafeNumber(value: bigint, field: string): number {
  if (value < -MAX_SAFE_INTEGER_BIGINT || value > MAX_SAFE_INTEGER_BIGINT) {
    throw new RangeError(`${field} exceeds the safe integer range`);
  }
  return Number(value);
}

function toPositiveSafeBigInt(value: number, field: string): bigint {
  return BigInt(assertPositiveVndAmount(value, field));
}

function toDateDay(value: DateOnly, field: string): number {
  const parsed = dateOnlySchema.safeParse(value);
  if (!parsed.success) {
    throw new TypeError(`${field} must be a valid date-only value`);
  }
  const [yearText, monthText, dayText] = parsed.data.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  const timestamp = date.getTime();
  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`${field} must be a valid date-only value`);
  }
  return timestamp / MILLIS_PER_DAY;
}

function floorDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new RangeError('floor division requires a positive denominator');
  }
  if (numerator >= 0n) {
    return numerator / denominator;
  }
  return -((-numerator + denominator - 1n) / denominator);
}

function ensureUniqueTransactionIds(
  transactions: readonly BudgetTransaction[]
): void {
  const ids = new Set<string>();
  for (const transaction of transactions) {
    if (ids.has(transaction.id)) {
      throw new Error(`Duplicate budget transaction ${transaction.id}`);
    }
    ids.add(transaction.id);
    toDateDay(transaction.occurredOn, `transaction ${transaction.id} date`);
    if (transaction.status === 'complete') {
      toPositiveSafeBigInt(
        transaction.amount,
        `transaction ${transaction.id} amount`
      );
    } else if (transaction.amount !== null) {
      toPositiveSafeBigInt(transaction.amount, `draft ${transaction.id} amount`);
    }
  }
}

function validateShares(
  transactions: readonly BudgetTransaction[],
  shares: readonly BudgetShare[]
): {
  ownShareByTransaction: ReadonlyMap<string, bigint>;
} {
  const transactionsById = new Map(
    transactions.map((transaction) => [transaction.id, transaction])
  );
  const totals = new Map<string, bigint>();
  const ownShares = new Map<string, bigint>();
  const participantIdsByTransaction = new Map<string, Set<string | null>>();

  for (const share of shares) {
    const transaction = transactionsById.get(share.transactionId);
    if (transaction === undefined) {
      throw new Error(
        `Share references unknown transaction ${share.transactionId}`
      );
    }
    if (transaction.direction !== 'expense' || transaction.amount === null) {
      throw new Error(
        `Shares require an expense with a known amount ${share.transactionId}`
      );
    }
    const participantIds =
      participantIdsByTransaction.get(share.transactionId) ?? new Set();
    if (participantIds.has(share.contactId)) {
      throw new Error(`Duplicate participant in split ${share.transactionId}`);
    }
    participantIds.add(share.contactId);
    participantIdsByTransaction.set(share.transactionId, participantIds);

    const amount = toPositiveSafeBigInt(
      share.shareAmount,
      `share ${share.transactionId} amount`
    );
    totals.set(
      share.transactionId,
      (totals.get(share.transactionId) ?? 0n) + amount
    );
    if (share.contactId === null) {
      ownShares.set(share.transactionId, amount);
    }
  }

  for (const [transactionId, total] of totals) {
    const transaction = transactionsById.get(transactionId);
    if (transaction === undefined || transaction.amount === null) {
      throw new Error(`Invalid split transaction ${transactionId}`);
    }
    if (total !== BigInt(transaction.amount)) {
      throw new Error(
        `Split shares must equal transaction ${transactionId} amount`
      );
    }
    if (!ownShares.has(transactionId)) {
      throw new Error(`Split ${transactionId} is missing your share`);
    }
  }

  return { ownShareByTransaction: ownShares };
}

function validateInput(input: BudgetInput): ValidatedBudgetInput {
  const todayDay = toDateDay(input.today, 'today');
  const horizonDay = toDateDay(input.monthConfig.horizonDate, 'horizon date');
  toDateDay(`${input.monthConfig.period}-01` as DateOnly, 'period');
  ensureUniqueTransactionIds(input.transactions);
  for (const balance of input.accountBalances) {
    assertVndInteger(balance, 'account balance');
  }
  assertNonNegativeVndAmount(input.reservedUnpaid, 'reserved unpaid');
  assertNonNegativeVndAmount(input.owedToYou, 'owed to you');
  const splitData = validateShares(input.transactions, input.shares);
  return { ...input, todayDay, horizonDay, ...splitData };
}

function ownExpenseAmount(
  transaction: BudgetTransaction,
  ownShareByTransaction: ReadonlyMap<string, bigint>
): bigint {
  if (transaction.direction !== 'expense' || transaction.amount === null) {
    return 0n;
  }
  const splitShare = ownShareByTransaction.get(transaction.id);
  if (splitShare !== undefined) {
    return splitShare;
  }
  // Payer controls cash movement and debt; no share rows means the whole purchase is yours.
  return BigInt(transaction.amount);
}

function isInPeriod(transaction: BudgetTransaction, period: Period): boolean {
  // Period reporting follows the stored date, while the burn window stops at today.
  return transaction.occurredOn.slice(0, 7) === period;
}

function ownExpenseInBurnWindow(
  transaction: BudgetTransaction,
  todayDay: number,
  ownShareByTransaction: ReadonlyMap<string, bigint>
): bigint {
  const transactionDay = toDateDay(transaction.occurredOn, 'transaction date');
  const age = todayDay - transactionDay;
  return age >= 0 && age < DAYS_IN_BURN_WINDOW
    ? ownExpenseAmount(transaction, ownShareByTransaction)
    : 0n;
}

export function computeBudget(input: BudgetInput): BudgetSnapshot {
  const validated = validateInput(input);
  let balanceTotal = 0n;
  for (const balance of validated.accountBalances) {
    balanceTotal += BigInt(balance);
  }
  const reservedUnpaid = BigInt(validated.reservedUnpaid);
  const discretionary = balanceTotal - reservedUnpaid;

  const daysToHorizon = Math.max(0, validated.horizonDay - validated.todayDay);
  const perDay =
    daysToHorizon === 0
      ? null
      : toSafeNumber(
          floorDivide(discretionary, BigInt(daysToHorizon)),
          'per day'
        );

  let spentThisMonth = 0n;
  let regrettedThisMonth = 0n;
  let burnLastThirtyDays = 0n;
  let unloggedDrafts = 0;
  for (const transaction of validated.transactions) {
    if (transaction.status === 'draft' && transaction.amount === null) {
      unloggedDrafts += 1;
    }
    if (!isInPeriod(transaction, validated.monthConfig.period)) {
      burnLastThirtyDays += ownExpenseInBurnWindow(
        transaction,
        validated.todayDay,
        validated.ownShareByTransaction
      );
      continue;
    }
    const ownAmount = ownExpenseAmount(
      transaction,
      validated.ownShareByTransaction
    );
    spentThisMonth += ownAmount;
    if (transaction.quality === 'regret') {
      regrettedThisMonth += ownAmount;
    }
    burnLastThirtyDays += ownExpenseInBurnWindow(
      transaction,
      validated.todayDay,
      validated.ownShareByTransaction
    );
  }

  const runwayDays =
    discretionary <= 0n
      ? 0
      : burnLastThirtyDays === 0n
        ? null
        : toSafeNumber(
            floorDivide(
              discretionary * BigInt(DAYS_IN_BURN_WINDOW),
              burnLastThirtyDays
            ),
            'runway days'
          );

  return {
    balanceTotal: toSafeNumber(balanceTotal, 'balance total'),
    reservedUnpaid: validated.reservedUnpaid,
    discretionary: toSafeNumber(discretionary, 'discretionary'),
    horizonDate: validated.monthConfig.horizonDate,
    daysToHorizon,
    perDay,
    runwayDays,
    spentThisMonth: toSafeNumber(spentThisMonth, 'monthly spending'),
    regrettedThisMonth: toSafeNumber(regrettedThisMonth, 'monthly regret'),
    owedToYou: validated.owedToYou,
    unloggedDrafts,
    updatedAt: validated.updatedAt,
  };
}
