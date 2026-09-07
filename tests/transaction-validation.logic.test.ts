import { strict as assert } from 'node:assert';

import { MAX_VND_AMOUNT } from '../src/money/currency';
import {
  draftVndInputSchema,
  positiveVndInputSchema,
} from '../src/data/money-validation';
import {
  createTransactionInputSchema,
  transactionSchema,
} from '../src/data/transaction-validation';

const accountId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';
const transactionId = '33333333-3333-4333-8333-333333333333';
const occurredAt = new Date(1735689600000);

const completeFields = {
  id: transactionId,
  accountId,
  quality: null,
  payer: { kind: 'you' as const },
  occurredAt,
  photoKey: null,
  note: null,
  sourceLabel: null,
  createdAt: occurredAt,
  updatedAt: occurredAt,
  deletedAt: null,
  status: 'complete' as const,
  amount: 45_000,
};

test('the transaction union narrows amount by status', () => {
  const draft = transactionSchema.parse({
    ...completeFields,
    status: 'draft',
    amount: null,
    direction: 'expense',
    categoryId: null,
  });
  const complete = transactionSchema.parse({
    ...completeFields,
    direction: 'expense',
    categoryId,
  });

  assert.equal(draft.status, 'draft');
  assert.equal(draft.amount, null);
  assert.equal(complete.status, 'complete');
  assert.equal(complete.amount, 45_000);
});

test('complete expenses require a category, while drafts do not', () => {
  assert.throws(() =>
    transactionSchema.parse({
      ...completeFields,
      direction: 'expense',
      categoryId: null,
    })
  );
  assert.doesNotThrow(() =>
    transactionSchema.parse({
      ...completeFields,
      status: 'draft',
      amount: null,
      direction: 'expense',
      categoryId: null,
    })
  );
});

test('direction carries the sign and every direction accepts positive integer money', () => {
  for (const direction of ['expense', 'income', 'adjustment', 'transfer'] as const) {
    const parsed = transactionSchema.parse({
      ...completeFields,
      direction,
      categoryId: direction === 'expense' ? categoryId : null,
      sourceLabel: direction === 'income' ? 'Salary' : null,
    });
    assert.equal(parsed.amount, 45_000);
    assert.equal(parsed.direction, direction);
  }
});

test('income has a source label and no category', () => {
  const parsed = createTransactionInputSchema.parse({
    accountId,
    direction: 'income',
    status: 'complete',
    amount: '45000',
    occurredAt,
    sourceLabel: 'Salary',
  });
  assert.equal(parsed.sourceLabel, 'Salary');
  assert.equal(parsed.categoryId, null);
  assert.equal(parsed.amount, 45_000);
});

test('draft blank or omitted amounts become null, never zero', () => {
  assert.equal(draftVndInputSchema.parse('   '), null);
  assert.equal(draftVndInputSchema.parse(undefined), null);
  assert.equal(
    createTransactionInputSchema.parse({
      accountId,
      direction: 'expense',
      status: 'draft',
      amount: '',
      occurredAt,
    }).amount,
    null
  );
});

test('amount input rejects zero, negative, fractional, and unsafe values without rounding', () => {
  for (const value of [0, -1, 12.5, MAX_VND_AMOUNT + 1, '12.5', '-1', (BigInt(MAX_VND_AMOUNT) + 1n).toString()]) {
    assert.throws(() => positiveVndInputSchema.parse(value));
  }
  assert.equal(positiveVndInputSchema.parse((MAX_VND_AMOUNT).toString()), MAX_VND_AMOUNT);
});

test('income, adjustment, and transfer cannot carry a category', () => {
  for (const direction of ['income', 'adjustment', 'transfer'] as const) {
    assert.throws(() =>
      transactionSchema.parse({
        ...completeFields,
        direction,
        categoryId,
      })
    );
  }
});
