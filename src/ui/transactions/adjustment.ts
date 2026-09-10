import type {
  AdjustmentEffect,
  Transaction,
} from '../../data/transaction-validation';

export type { AdjustmentEffect } from '../../data/transaction-validation';

/** Reads the explicit effect carried by an adjustment without treating amount as signed. */
export function adjustmentEffect(transaction: Transaction): AdjustmentEffect | undefined {
  if (transaction.direction !== 'adjustment') return undefined;
  if (transaction.adjustmentEffect === 'increase') {
    return 'increase';
  }
  if (transaction.adjustmentEffect === 'decrease') {
    return 'decrease';
  }
  return undefined;
}

export function adjustmentEffectLabel(transaction: Transaction): string | undefined {
  const effect = adjustmentEffect(transaction);
  return effect === 'increase'
    ? 'Balance increased'
    : effect === 'decrease'
      ? 'Balance decreased'
      : undefined;
}
