import { strict as assert } from 'node:assert';

import { MAX_VND_AMOUNT } from '../src/money/currency';
import {
  commitmentSchema,
  createCommitmentInputSchema,
  editCommitmentInputSchema,
} from '../src/data/commitment-validation';

const categoryId = '11111111-1111-4111-8111-111111111111';
const commitmentId = '22222222-2222-4222-8222-222222222222';
const timestamp = new Date('2026-01-01T00:00:00.000Z');

test('create commitment input trims names, parses money, and defaults active', () => {
  assert.deepEqual(
    createCommitmentInputSchema.parse({
      name: ' Rent ',
      amount: '12000000',
      dueDay: 31,
      categoryId,
    }),
    {
      name: 'Rent',
      amount: 12_000_000,
      dueDay: 31,
      categoryId,
      active: true,
    }
  );
});

test('commitment rows include the soft-delete timestamps', () => {
  const parsed = commitmentSchema.parse({
    id: commitmentId,
    name: 'Rent',
    amount: 12_000_000,
    dueDay: 31,
    categoryId,
    active: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  });

  assert.equal(parsed.deletedAt, null);
  assert.equal(parsed.active, false);
});

test('edit commitment input is partial, strict, and keeps validated money', () => {
  assert.deepEqual(
    editCommitmentInputSchema.parse({
      commitmentId,
      changes: { name: ' Utilities ', amount: '900000' },
    }),
    {
      commitmentId,
      changes: { name: 'Utilities', amount: 900_000 },
    }
  );
});

test('commitment schemas reject malformed names, IDs, days, money, and extras', () => {
  const valid = {
    name: 'Rent',
    amount: 12_000_000,
    dueDay: 31,
    categoryId,
  };

  for (const invalid of [
    { ...valid, name: '   ' },
    { ...valid, amount: 0 },
    { ...valid, amount: MAX_VND_AMOUNT + 1 },
    { ...valid, amount: 12.5 },
    { ...valid, dueDay: 0 },
    { ...valid, dueDay: 32 },
    { ...valid, dueDay: 1.5 },
    { ...valid, categoryId: 'category-id' },
    { ...valid, extra: true },
  ]) {
    assert.equal(createCommitmentInputSchema.safeParse(invalid).success, false);
  }

  assert.equal(
    editCommitmentInputSchema.safeParse({
      commitmentId,
      changes: { dueDay: 32 },
    }).success,
    false
  );
  assert.equal(
    editCommitmentInputSchema.safeParse({
      commitmentId,
      changes: { unexpected: true },
    }).success,
    false
  );
});
