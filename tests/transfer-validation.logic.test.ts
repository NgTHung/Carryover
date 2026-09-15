import { strict as assert } from 'node:assert';

import { assertManualOccurredAt } from '../src/data/manual-transaction-policy';

test('transfer date validation compares local calendar dates and allows later today', () => {
  const submittedAt = new Date(2025, 0, 2, 8);
  assert.doesNotThrow(() => assertManualOccurredAt(new Date(2025, 0, 2, 23), submittedAt));
  assert.doesNotThrow(() => assertManualOccurredAt(new Date(2024, 11, 31, 23), submittedAt));
  assert.throws(
    () => assertManualOccurredAt(new Date(2025, 0, 3, 0), submittedAt),
    /future/
  );
});
