/**
 * Match logged payments to recurring reserve commitments.
 *
 * Matching is deliberately independent of SQLite. A payment clears one
 * commitment at most, and stable ordering keeps duplicate commitments
 * predictable without comparing the reserved amount to the actual charge.
 */
import { MAX_VND_AMOUNT } from '../money/currency';

export type UnpaidReserveCommitment = {
  id: string;
  amount: number;
  categoryId: string;
  dueDate: string;
};

export type UnpaidReservePayment = {
  id: string;
  categoryId: string;
  occurredAt: Date;
};

export type CommitmentReserveMatch =
  | {
      status: 'paid';
      commitment: UnpaidReserveCommitment;
      payment: UnpaidReservePayment;
    }
  | {
      status: 'unpaid';
      commitment: UnpaidReserveCommitment;
    };

export type UnpaidReserveTotal =
  | { status: 'available'; amount: number }
  | { status: 'overflow' };

function compareCommitments(
  left: UnpaidReserveCommitment,
  right: UnpaidReserveCommitment
): number {
  return left.dueDate.localeCompare(right.dueDate) || left.id.localeCompare(right.id);
}

function comparePayments(
  left: UnpaidReservePayment,
  right: UnpaidReservePayment
): number {
  return (
    left.occurredAt.getTime() - right.occurredAt.getTime() ||
    left.id.localeCompare(right.id)
  );
}

export function matchCommitmentReserves(
  commitments: readonly UnpaidReserveCommitment[],
  payments: readonly UnpaidReservePayment[]
): CommitmentReserveMatch[] {
  const paymentsByCategory = new Map<string, UnpaidReservePayment[]>();
  for (const payment of payments) {
    const categoryPayments = paymentsByCategory.get(payment.categoryId) ?? [];
    categoryPayments.push(payment);
    paymentsByCategory.set(payment.categoryId, categoryPayments);
  }
  for (const categoryPayments of paymentsByCategory.values()) {
    categoryPayments.sort(comparePayments);
  }

  const paymentIndexes = new Map<string, number>();
  const matches: CommitmentReserveMatch[] = [];
  const orderedCommitments = [...commitments].sort(compareCommitments);
  for (const commitment of orderedCommitments) {
    const categoryPayments = paymentsByCategory.get(commitment.categoryId);
    const paymentIndex = paymentIndexes.get(commitment.categoryId) ?? 0;
    if (categoryPayments !== undefined && paymentIndex < categoryPayments.length) {
      paymentIndexes.set(commitment.categoryId, paymentIndex + 1);
      matches.push({
        status: 'paid',
        commitment,
        payment: categoryPayments[paymentIndex],
      });
      continue;
    }
    matches.push({ status: 'unpaid', commitment });
  }
  return matches;
}

export function summarizeUnpaidReserve(
  matches: readonly CommitmentReserveMatch[]
): UnpaidReserveTotal {
  let total = 0n;
  for (const match of matches) {
    if (match.status === 'paid') continue;
    total += BigInt(match.commitment.amount);
    if (total > BigInt(MAX_VND_AMOUNT)) {
      return { status: 'overflow' };
    }
  }
  return { status: 'available', amount: Number(total) };
}

export function calculateUnpaidReserve(
  commitments: readonly UnpaidReserveCommitment[],
  payments: readonly UnpaidReservePayment[]
): number {
  const total = summarizeUnpaidReserve(
    matchCommitmentReserves(commitments, payments)
  );
  if (total.status === 'overflow') {
    throw new RangeError('reserved unpaid exceeds the safe VND amount');
  }
  return total.amount;
}
