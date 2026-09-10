import { strict as assert } from 'node:assert';

import type { BudgetSnapshot } from '../src/budget/snapshot';
import {
  decodeSnapshotFromSharedStorage,
  encodeSnapshotForSharedStorage,
} from '../src/budget/snapshot-storage';

function snapshot(overrides: Partial<BudgetSnapshot> = {}): BudgetSnapshot {
  return {
    balanceTotal: 1_000,
    reservedUnpaid: 100,
    discretionary: 900,
    horizonDate: '2026-09-30',
    daysToHorizon: 20,
    perDay: 45,
    runwayDays: 30,
    spentThisMonth: 100,
    regrettedThisMonth: 0,
    owedToYou: 0,
    unloggedDrafts: 0,
    updatedAt: '2026-09-10T00:00:00.000Z',
    ...overrides,
  };
}

test('nullable figures survive the property-list-safe storage encoding', () => {
  const original = snapshot({ perDay: null, runwayDays: null });
  const stored = encodeSnapshotForSharedStorage(original);

  assert.equal(stored.perDay, 'unavailable');
  assert.equal(stored.runwayDays, 'unavailable');
  assert.equal(JSON.stringify(stored).includes('null'), false);
  assert.deepEqual(decodeSnapshotFromSharedStorage(stored), original);
});

test('available integer figures round trip without numeric conversion', () => {
  const original = snapshot({ perDay: -45, runwayDays: 0 });
  const stored = encodeSnapshotForSharedStorage(original);

  assert.equal(stored.perDay, -45);
  assert.equal(stored.runwayDays, 0);
  assert.deepEqual(decodeSnapshotFromSharedStorage(stored), original);
});
