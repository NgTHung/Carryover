import { strict as assert } from 'node:assert';

import { parseHorizonRoute } from '../src/ui/horizon/load-horizon-route';

const now = new Date(2026, 8, 14);

test('horizon route accepts one selected period and defaults a missing value', () => {
  assert.deepEqual(parseHorizonRoute('2026-02', now), {
    status: 'valid', period: '2026-02', defaulted: false,
  });
  assert.deepEqual(parseHorizonRoute(undefined, now), {
    status: 'valid', period: '2026-09', defaulted: true,
  });
});

test('horizon route rejects malformed and repeated periods', () => {
  for (const value of ['2026-13', '2026-9', '', ['2026-09'], ['2026-08', '2026-09']]) {
    assert.equal(parseHorizonRoute(value, now).status, 'invalid');
  }
});

test('horizon route stays pinned to the selected period across year boundaries', () => {
  assert.deepEqual(parseHorizonRoute('2026-12', new Date(2027, 0, 1)), {
    status: 'valid', period: '2026-12', defaulted: false,
  });
  assert.deepEqual(parseHorizonRoute('2026-09', new Date(2026, 9, 15)), {
    status: 'valid', period: '2026-09', defaulted: false,
  });
});
