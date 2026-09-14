import { strict as assert } from 'node:assert';

import {
  compareDateOnly,
  dateOnlyFromLocalDate,
  dateOnlySchema,
  localDateFromDateOnly,
} from '../src/data/date-only';
import { assertManualOccurredAt } from '../src/data/manual-transaction-policy';

test('date-only conversion preserves local time and validates leap days', () => {
  const anchor = new Date(2026, 8, 15, 14, 27, 33, 456);
  const leapDay = localDateFromDateOnly('2024-02-29', anchor);

  assert.equal(dateOnlyFromLocalDate(leapDay), '2024-02-29');
  assert.equal(leapDay.getHours(), anchor.getHours());
  assert.equal(leapDay.getMinutes(), anchor.getMinutes());
  assert.equal(leapDay.getSeconds(), anchor.getSeconds());
  assert.equal(leapDay.getMilliseconds(), anchor.getMilliseconds());
  assert.throws(() => localDateFromDateOnly('2023-02-29', anchor));
  assert.equal(dateOnlySchema.safeParse('2024-02-30').success, false);
});

test('date-only comparison uses calendar order without UTC conversion', () => {
  assert.equal(compareDateOnly('2026-09-15', '2026-09-15'), 0);
  assert.equal(compareDateOnly('2026-09-14', '2026-09-15'), -1);
  assert.equal(compareDateOnly('2026-09-16', '2026-09-15'), 1);
  assert.throws(() => compareDateOnly('2026-09-31', '2026-09-15'));
});

test('manual dates allow the whole local today and reject tomorrow across midnight', () => {
  const justAfterMidnight = new Date(2026, 8, 15, 0, 1);
  assert.doesNotThrow(() =>
    assertManualOccurredAt(new Date(2026, 8, 15, 23, 59), justAfterMidnight)
  );
  assert.doesNotThrow(() =>
    assertManualOccurredAt(new Date(2026, 8, 14, 23, 59), justAfterMidnight)
  );
  assert.throws(
    () => assertManualOccurredAt(new Date(2026, 8, 16, 0, 0), justAfterMidnight),
    /future/i
  );
});
