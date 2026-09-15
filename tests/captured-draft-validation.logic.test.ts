import { strict as assert } from 'node:assert';

import { parseCapturedDraftInput } from '../src/data/captured-draft-validation';

const draftId = '123e4567-e89b-42d3-a456-426614174000';
const photoKey = 'photos/v1/123e4567-e89b-42d3-a456-426614174001.jpg';
const occurredAt = new Date(2026, 8, 15, 12, 30);

function input(amount: unknown) {
  return { draftId, photoKey, amount, occurredAt };
}

test('blank capture amounts become an explicit unknown', () => {
  assert.equal(parseCapturedDraftInput(input('   ')).amount, null);
  assert.equal(parseCapturedDraftInput(input(null)).amount, null);
});

test('positive whole-dong amounts remain exact', () => {
  assert.equal(parseCapturedDraftInput(input('1')).amount, 1);
  assert.equal(parseCapturedDraftInput(input('9007199254740991')).amount, Number.MAX_SAFE_INTEGER);
  assert.equal(parseCapturedDraftInput(input(45_001)).amount, 45_001);
});

test.each([
  ['0', 'zero text'],
  ['-1', 'negative text'],
  ['1.5', 'fractional text'],
  ['1e3', 'exponential text'],
  ['1,000', 'separated text'],
  ['abc', 'non-digit text'],
  ['9007199254740992', 'unsafe text'],
  [Number.NaN, 'NaN'],
  [Number.POSITIVE_INFINITY, 'infinity'],
])('rejects %s amounts', (amount, label) => {
  assert.throws(() => parseCapturedDraftInput(input(amount)), /amount|finite|safe/i, label);
});

test('validates the route UUID and retained photo key', () => {
  assert.equal(parseCapturedDraftInput(input('100')).draftId, draftId);
  assert.equal(parseCapturedDraftInput(input('100')).photoKey, photoKey);
  assert.throws(
    () => parseCapturedDraftInput({ ...input('100'), draftId: 'capture-1' }),
    /uuid/i
  );
  assert.throws(
    () => parseCapturedDraftInput({ ...input('100'), photoKey: 'file:///tmp/photo.jpg' }),
    /photo key/i
  );
});

test('rejects invalid dates before SQLite work begins', () => {
  assert.throws(
    () => parseCapturedDraftInput({ ...input('100'), occurredAt: new Date('invalid') }),
    /date/i
  );
});
