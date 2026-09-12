/**
 * Computes the period report from a stored config and normalized ledger rows.
 *
 * The read model owns SQLite access, while this module owns every report total.
 * BigInt keeps sums exact until the final safe-integer conversion, and the
 * same own-share resolver used by the budget snapshot keeps both surfaces true.
 */
import {
  assertPositiveVndAmount,
  MAX_VND_AMOUNT,
} from '../money/currency';
import {
  monthConfigSchema,
  type MonthConfig,
} from '../data/month-config-validation';
import {
  ownExpenseAmount,
  resolveOwnShareAmounts,
  type OwnExpenseShare,
} from '../money/own-expense';
import { dateOnlySchema, type DateOnly } from '../data/date-only';
import { periodSchema, type Period } from '../data/period';
import {
  transactionQualitySchema,
  type TransactionQuality,
} from '../data/transaction-validation';

const MAX_SAFE_INTEGER_BIGINT = BigInt(MAX_VND_AMOUNT);
const QUALITY_BUCKETS = ['need', 'want', 'regret', 'unrated'] as const;

export type QualityBucket = (typeof QUALITY_BUCKETS)[number];

export type SummaryCategory = {
  id: string;
  name: string;
};

export type MonthSummaryTransaction = {
  id: string;
  direction: 'expense' | 'income' | 'adjustment' | 'transfer';
  status: 'draft' | 'complete';
  amount: number | null;
  quality: TransactionQuality | null;
  occurredOn: DateOnly;
  group: SummaryCategory | null;
  leaf: SummaryCategory | null;
};

export type MonthSummaryInput = {
  period: Period;
  monthConfig: MonthConfig;
  transactions: readonly MonthSummaryTransaction[];
  shares: readonly OwnExpenseShare[];
};

export type MonthSummaryLeaf = SummaryCategory & {
  amount: number;
};

export type MonthSummaryGroup = SummaryCategory & {
  amount: number;
  leaves: MonthSummaryLeaf[];
};

export type MonthSummaryQuality = {
  quality: QualityBucket;
  amount: number;
  showDirectLabel: boolean;
};

export type MonthSummary = {
  period: Period;
  monthConfig: MonthConfig;
  totalSpent: number;
  regrettedTotal: number;
  unknownDrafts: number;
  groups: MonthSummaryGroup[];
  quality: MonthSummaryQuality[];
};

type LeafAccumulator = {
  id: string;
  name: string;
  amount: bigint;
};

type GroupAccumulator = {
  id: string;
  name: string;
  amount: bigint;
  leaves: Map<string, LeafAccumulator>;
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

function compareAmountThenName(
  left: { amount: bigint; name: string; id: string },
  right: { amount: bigint; name: string; id: string }
): number {
  if (left.amount !== right.amount) return left.amount > right.amount ? -1 : 1;
  const nameOrder = left.name.localeCompare(right.name);
  return nameOrder !== 0 ? nameOrder : left.id.localeCompare(right.id);
}

function addGroupAmount(
  groups: Map<string, GroupAccumulator>,
  transaction: MonthSummaryTransaction,
  amount: bigint
): void {
  const groupId = transaction.group?.id ?? 'uncategorized';
  const group = groups.get(groupId) ?? {
    id: groupId,
    name: transaction.group?.name ?? 'No group yet',
    amount: 0n,
    leaves: new Map<string, LeafAccumulator>(),
  };
  group.amount += amount;

  if (transaction.leaf !== null && transaction.group !== null) {
    const leaf = group.leaves.get(transaction.leaf.id) ?? {
      id: transaction.leaf.id,
      name: transaction.leaf.name,
      amount: 0n,
    };
    leaf.amount += amount;
    group.leaves.set(transaction.leaf.id, leaf);
  }
  groups.set(groupId, group);
}

export function computeMonthSummary(input: MonthSummaryInput): MonthSummary {
  const period = periodSchema.parse(input.period);
  const monthConfig = monthConfigSchema.parse(input.monthConfig);
  if (monthConfig.period !== period) {
    throw new RangeError(
      `Month config ${input.monthConfig.period} does not match period ${period}`
    );
  }

  const transactionsById = new Map<string, MonthSummaryTransaction>();
  for (const transaction of input.transactions) {
    if (transactionsById.has(transaction.id)) {
      throw new Error(`Duplicate report transaction ${transaction.id}`);
    }
    validateTransaction(transaction, period);
    transactionsById.set(transaction.id, transaction);
  }

  const ownShareByTransaction = resolveOwnShareAmounts(
    input.transactions,
    input.shares
  );
  const groups = new Map<string, GroupAccumulator>();
  const qualityTotals = new Map<QualityBucket, bigint>(
    QUALITY_BUCKETS.map((quality) => [quality, 0n])
  );
  let totalSpent = 0n;
  let unknownDrafts = 0;

  for (const transaction of input.transactions) {
    if (transaction.direction !== 'expense') continue;
    if (transaction.status === 'draft' && transaction.amount === null) {
      unknownDrafts += 1;
      continue;
    }

    const amount = ownExpenseAmount(transaction, ownShareByTransaction);
    totalSpent += amount;
    addGroupAmount(groups, transaction, amount);
    const quality: QualityBucket = transaction.quality ?? 'unrated';
    qualityTotals.set(quality, (qualityTotals.get(quality) ?? 0n) + amount);
  }

  const quality = QUALITY_BUCKETS.map((qualityName) => {
    const amount = qualityTotals.get(qualityName) ?? 0n;
    return {
      quality: qualityName,
      amount: toSafeNumber(amount, `${qualityName} report total`),
      showDirectLabel:
        totalSpent > 0n && amount * 100n > totalSpent * 15n,
    };
  });

  return {
    period,
    monthConfig,
    totalSpent: toSafeNumber(totalSpent, 'report total'),
    regrettedTotal: toSafeNumber(
      qualityTotals.get('regret') ?? 0n,
      'regretted report total'
    ),
    unknownDrafts,
    groups: [...groups.values()]
      .sort(compareAmountThenName)
      .map((group) => ({
        id: group.id,
        name: group.name,
        amount: toSafeNumber(group.amount, `group ${group.id} total`),
        leaves: [...group.leaves.values()]
          .sort(compareAmountThenName)
          .map((leaf) => ({
            id: leaf.id,
            name: leaf.name,
            amount: toSafeNumber(leaf.amount, `leaf ${leaf.id} total`),
          })),
      })),
    quality,
  };
}
