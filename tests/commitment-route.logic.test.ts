import { strict as assert } from 'node:assert';

import { parseCommitmentRoute } from '../src/ui/commitments/load-commitment-route';

const now = new Date(2026, 8, 14);

test('commitment route accepts one period and defaults a missing value', () => {
  assert.deepEqual(parseCommitmentRoute('2026-02', now), {
    status: 'valid', period: '2026-02', defaulted: false,
  });
  assert.deepEqual(parseCommitmentRoute(undefined, now), {
    status: 'valid', period: '2026-09', defaulted: true,
  });
});

test('commitment route rejects malformed and repeated periods', () => {
  for (const value of ['2026-13', '2026-9', '', ['2026-09'], ['2026-08', '2026-09']]) {
    assert.equal(parseCommitmentRoute(value, now).status, 'invalid');
  }
});
