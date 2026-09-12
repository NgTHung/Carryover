/**
 * Resolves the amount of an expense that belongs to you.
 *
 * A purchase without share rows is the ordinary unsplit case, so the full
 * amount belongs to you. Once share rows exist, the null contact id is your
 * share. Keeping validation and resolution here prevents the budget and report
 * surfaces from disagreeing about one ledger row.
 */
import {
  assertPositiveVndAmount,
  MAX_VND_AMOUNT,
} from './currency';

const MAX_SAFE_INTEGER_BIGINT = BigInt(MAX_VND_AMOUNT);

export type OwnExpenseTransaction = {
  id: string;
  direction: 'expense' | 'income' | 'adjustment' | 'transfer';
  amount: number | null;
};

export type OwnExpenseShare = {
  transactionId: string;
  contactId: string | null;
  shareAmount: number;
};

function toPositiveBigInt(value: number, field: string): bigint {
  return BigInt(assertPositiveVndAmount(value, field));
}

/**
 * Validates active share rows and returns the own share for every split.
 * Transactions are validated by their caller before this boundary; share rows
 * still validate their referenced expense and exact amount here.
 */
export function resolveOwnShareAmounts(
  transactions: readonly OwnExpenseTransaction[],
  shares: readonly OwnExpenseShare[]
): ReadonlyMap<string, bigint> {
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

    const amount = toPositiveBigInt(
      share.shareAmount,
      `share ${share.transactionId} amount`
    );
    const nextTotal = (totals.get(share.transactionId) ?? 0n) + amount;
    if (nextTotal > MAX_SAFE_INTEGER_BIGINT) {
      throw new RangeError(
        `split ${share.transactionId} total exceeds the safe integer range`
      );
    }
    totals.set(share.transactionId, nextTotal);
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

  return ownShares;
}

export function ownExpenseAmount(
  transaction: OwnExpenseTransaction,
  ownShareByTransaction: ReadonlyMap<string, bigint>
): bigint {
  if (transaction.direction !== 'expense' || transaction.amount === null) {
    return 0n;
  }
  return ownShareByTransaction.get(transaction.id) ?? BigInt(transaction.amount);
}
