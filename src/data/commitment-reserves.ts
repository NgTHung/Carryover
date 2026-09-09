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

function addUnpaidAmount(total: bigint, amount: number): bigint {
  const next = total + BigInt(amount);
  if (next > BigInt(MAX_VND_AMOUNT)) {
    throw new RangeError('reserved unpaid exceeds the safe VND amount');
  }
  return next;
}

export function calculateUnpaidReserve(
  commitments: readonly UnpaidReserveCommitment[],
  payments: readonly UnpaidReservePayment[]
): number {
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
  let total = 0n;
  const orderedCommitments = [...commitments].sort(compareCommitments);
  for (const commitment of orderedCommitments) {
    const categoryPayments = paymentsByCategory.get(commitment.categoryId);
    const paymentIndex = paymentIndexes.get(commitment.categoryId) ?? 0;
    if (categoryPayments !== undefined && paymentIndex < categoryPayments.length) {
      paymentIndexes.set(commitment.categoryId, paymentIndex + 1);
      continue;
    }
    total = addUnpaidAmount(total, commitment.amount);
  }
  return Number(total);
}
