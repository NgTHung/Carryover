import { strict as assert } from 'node:assert';

import { resolveCommitmentDueDate } from '../src/data/commitment-period';

test('commitment due dates clamp to February, including leap years', () => {
  assert.equal(resolveCommitmentDueDate('2026-02', 31), '2026-02-28');
  assert.equal(resolveCommitmentDueDate('2024-02', 31), '2024-02-29');
  assert.equal(resolveCommitmentDueDate('2100-02', 31), '2100-02-28');
});

test('commitment due dates clamp to the final day of 30-day months', () => {
  assert.equal(resolveCommitmentDueDate('2026-04', 31), '2026-04-30');
  assert.equal(resolveCommitmentDueDate('2026-06', 30), '2026-06-30');
});

test('commitment due dates preserve valid days and local calendar formatting', () => {
  assert.equal(resolveCommitmentDueDate('2026-01', 31), '2026-01-31');
  assert.equal(resolveCommitmentDueDate('2026-09', 9), '2026-09-09');
});

test('commitment due dates reject malformed periods and days', () => {
  for (const period of ['2026-1', '2026-13', 'not-a-period']) {
    assert.throws(() => resolveCommitmentDueDate(period, 1));
  }
  for (const dueDay of [0, 32, 1.5, '31']) {
    assert.throws(() => resolveCommitmentDueDate('2026-01', dueDay));
  }
});
