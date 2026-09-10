/**
 * Encodes a snapshot into values that shared iOS preferences can store.
 *
 * UserDefaults accepts property-list values, which do not include null. The
 * sentinel preserves unavailable figures without turning them into zero.
 */
import type { BudgetSnapshot } from './snapshot';

export const UNAVAILABLE_SNAPSHOT_VALUE = 'unavailable' as const;

export type SharedBudgetSnapshot = Omit<
  BudgetSnapshot,
  'perDay' | 'runwayDays'
> & {
  perDay: number | typeof UNAVAILABLE_SNAPSHOT_VALUE;
  runwayDays: number | typeof UNAVAILABLE_SNAPSHOT_VALUE;
};

function encodeNullableFigure(
  value: number | null
): number | typeof UNAVAILABLE_SNAPSHOT_VALUE {
  return value ?? UNAVAILABLE_SNAPSHOT_VALUE;
}

export function decodeNullableFigure(
  value: number | typeof UNAVAILABLE_SNAPSHOT_VALUE
): number | null {
  return value === UNAVAILABLE_SNAPSHOT_VALUE ? null : value;
}

export function encodeSnapshotForSharedStorage(
  snapshot: BudgetSnapshot
): SharedBudgetSnapshot {
  return {
    ...snapshot,
    perDay: encodeNullableFigure(snapshot.perDay),
    runwayDays: encodeNullableFigure(snapshot.runwayDays),
  };
}

export function decodeSnapshotFromSharedStorage(
  snapshot: SharedBudgetSnapshot
): BudgetSnapshot {
  return {
    ...snapshot,
    perDay: decodeNullableFigure(snapshot.perDay),
    runwayDays: decodeNullableFigure(snapshot.runwayDays),
  };
}
