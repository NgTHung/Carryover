import {
  completeDraftWithRecovery,
  freezeDraftCompletionAttempt,
  reconcileDraftCompletion,
  sameCompletionFields,
} from '../src/ui/transactions/draft-completion-operation';
import { parseTransaction, type Transaction } from '../src/data/transaction-validation';
import type { TransactionFormValues, ValidatedTransactionForm } from '../src/ui/transactions/transaction-form';

const transactionId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const categoryId = '33333333-3333-4333-8333-333333333333';
const occurredAt = new Date(2026, 8, 15, 10, 30);

function draft(overrides: Record<string, unknown> = {}): Extract<Transaction, { status: 'draft' }> {
  const parsed = parseTransaction({
    id: transactionId,
    accountId,
    direction: 'expense',
    adjustmentEffect: null,
    amount: null,
    categoryId: null,
    quality: null,
    payer: { kind: 'you' },
    occurredAt,
    status: 'draft',
    photoKey: 'photos/v1/receipt.jpg',
    note: null,
    sourceLabel: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    deletedAt: null,
    ...overrides,
  });
  if (parsed.status !== 'draft') throw new Error('Expected a draft fixture');
  return parsed;
}

function complete(overrides: Record<string, unknown> = {}): Extract<Transaction, { status: 'complete' }> {
  const parsed = parseTransaction({
    ...draft(),
    status: 'complete',
    amount: 45_001,
    categoryId,
    ...overrides,
  });
  if (parsed.status !== 'complete') throw new Error('Expected a complete fixture');
  return parsed;
}

const values: TransactionFormValues = {
  amount: '45001',
  date: '2026-09-15',
  note: '',
  sourceLabel: '',
  direction: 'expense',
  accountId,
  categoryId,
  quality: null,
};

const validation: ValidatedTransactionForm = {
  valid: true,
  amount: 45_001,
  occurredAt,
  errors: {},
};

test('freezes the payload and expected row from one draft form snapshot', () => {
  const original = draft();
  const attempt = freezeDraftCompletionAttempt(original, values, validation);

  expect(attempt.transactionId).toBe(transactionId);
  expect(attempt.input).toEqual({
    transactionId,
    amount: 45_001,
    categoryId,
    changes: {},
  });
  expect(attempt.original.status).toBe('draft');
  expect(attempt.expected).toEqual(expect.objectContaining({
    id: transactionId,
    status: 'complete',
    amount: 45_001,
    categoryId,
    photoKey: original.photoKey,
  }));
  expect(Object.isFrozen(attempt)).toBe(true);
  expect(Object.isFrozen(attempt.input)).toBe(true);
  expect(Object.isFrozen(attempt.expected)).toBe(true);
});

test('reconciles an unchanged draft as retryable', async () => {
  const attempt = freezeDraftCompletionAttempt(draft(), values, validation);
  const result = await reconcileDraftCompletion(
    attempt,
    async () => draft(),
    new Error('write uncertain')
  );

  expect(result).toMatchObject({ status: 'retry', writeError: expect.any(Error) });
});

test('reconciles an exact complete row as committed', async () => {
  const attempt = freezeDraftCompletionAttempt(draft(), values, validation);
  const result = await completeDraftWithRecovery(
    attempt,
    async () => {
      throw new Error('connection lost after commit');
    },
    async () => attempt.expected
  );

  expect(result.status).toBe('committed');
  if (result.status === 'committed') {
    expect(result.transaction.id).toBe(transactionId);
    expect(sameCompletionFields(result.transaction, attempt.expected)).toBe(true);
  }
});

test('reports a changed complete row as a conflict', async () => {
  const attempt = freezeDraftCompletionAttempt(draft(), values, validation);
  const result = await reconcileDraftCompletion(
    attempt,
    async () => complete({ amount: 45_002 }),
    new Error('write uncertain')
  );

  expect(result).toMatchObject({ status: 'conflict', transaction: { amount: 45_002 } });
});

test('reports a missing or deleted row as unavailable', async () => {
  const attempt = freezeDraftCompletionAttempt(draft(), values, validation);
  const missing = await reconcileDraftCompletion(attempt, async () => undefined, new Error('failed'));
  const deleted = await reconcileDraftCompletion(
    attempt,
    async () => draft({ deletedAt: occurredAt }),
    new Error('failed')
  );

  expect(missing.status).toBe('unavailable');
  expect(deleted.status).toBe('unavailable');
});

test('keeps a failed reconciliation read distinct from a retryable write', async () => {
  const attempt = freezeDraftCompletionAttempt(draft(), values, validation);
  const readError = new Error('read failed');
  const result = await reconcileDraftCompletion(
    attempt,
    async () => { throw readError; },
    new Error('write failed')
  );

  expect(result).toMatchObject({ status: 'read-failed', readError });
});

test('treats a complete result from the facade as committed without reading again', async () => {
  const attempt = freezeDraftCompletionAttempt(draft(), values, validation);
  const readTransaction = jest.fn(async () => draft());
  const result = await completeDraftWithRecovery(
    attempt,
    async () => complete(),
    readTransaction
  );

  expect(result.status).toBe('committed');
  expect(readTransaction).not.toHaveBeenCalled();
});
