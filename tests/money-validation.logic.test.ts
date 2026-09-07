import { strict as assert } from 'node:assert';

import { MAX_VND_AMOUNT } from '../src/money/currency';
import {
  nonNegativeVndAmountSchema,
  positiveVndAmountSchema,
} from '../src/data/money-validation';

test('positive VND schema accepts whole safe amounts only', () => {
  assert.equal(positiveVndAmountSchema.parse(1), 1);
  assert.equal(positiveVndAmountSchema.parse(MAX_VND_AMOUNT), MAX_VND_AMOUNT);
  assert.throws(() => positiveVndAmountSchema.parse(0));
  assert.throws(() => positiveVndAmountSchema.parse(-1));
  assert.throws(() => positiveVndAmountSchema.parse(12.5));
  assert.throws(() => positiveVndAmountSchema.parse(MAX_VND_AMOUNT + 1));
  assert.throws(() => positiveVndAmountSchema.parse('1200'));
});

test('nonnegative VND schema permits zero and shares the safe bound', () => {
  assert.equal(nonNegativeVndAmountSchema.parse(0), 0);
  assert.equal(nonNegativeVndAmountSchema.parse(MAX_VND_AMOUNT), MAX_VND_AMOUNT);
  assert.throws(() => nonNegativeVndAmountSchema.parse(-1));
  assert.throws(() => nonNegativeVndAmountSchema.parse(12.5));
  assert.throws(() => nonNegativeVndAmountSchema.parse(MAX_VND_AMOUNT + 1));
});
