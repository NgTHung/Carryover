const mockUpdateSnapshot = jest.fn();

jest.mock('../widgets/CarryoverWidget', () => ({
  CarryoverWidget: {
    updateSnapshot: (...args: unknown[]) => mockUpdateSnapshot(...args),
  },
}));

import type { BudgetSnapshot } from '../src/budget/snapshot';
import { writeSharedSnapshot } from '../src/budget/snapshot-writer';

test('writes the complete snapshot with property-list-safe unavailable values', () => {
  const snapshot: BudgetSnapshot = {
    balanceTotal: 1_000,
    reservedUnpaid: 100,
    discretionary: 900,
    horizonDate: '2026-09-30',
    daysToHorizon: 0,
    perDay: null,
    runwayDays: null,
    spentThisMonth: 100,
    regrettedThisMonth: 0,
    owedToYou: 0,
    unloggedDrafts: 0,
    updatedAt: '2026-09-10T00:00:00.000Z',
  };

  writeSharedSnapshot(snapshot);

  expect(mockUpdateSnapshot).toHaveBeenCalledWith({
    ...snapshot,
    perDay: 'unavailable',
    runwayDays: 'unavailable',
  });
});
