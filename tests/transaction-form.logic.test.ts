import { strict as assert } from 'node:assert';

import type { ActiveAccount } from '../src/data/accounts';
import { parseTransaction, type Transaction } from '../src/data/transaction-validation';
import {
  buildCompleteCreatePayload,
  buildCompleteDraftPayload,
  buildEditChanges,
  initializeCreationForm,
  initializeEditorForm,
  transitionDirection,
  validateCreationTransactionForm,
  validateTransactionForm,
  type TransactionFormValues,
} from '../src/ui/transactions/transaction-form';

const now = new Date(2026, 8, 15, 12, 30);
const bank: ActiveAccount = {
  accountId: '11111111-1111-4111-8111-111111111111',
  name: 'Bank',
  kind: 'bank',
  isDefault: true,
};
const cash: ActiveAccount = { ...bank, accountId: '22222222-2222-4222-8222-222222222222', name: 'Cash', kind: 'cash', isDefault: false };
const categoryId = '33333333-3333-4333-8333-333333333333';
const transactionId = '44444444-4444-4444-8444-444444444444';

function values(overrides: Partial<TransactionFormValues> = {}): TransactionFormValues {
  return {
    amount: '125000',
    date: '2026-09-15',
    note: '',
    sourceLabel: '',
    direction: 'expense',
    accountId: bank.accountId,
    categoryId,
    quality: null,
    ...overrides,
  };
}

function transaction(): Extract<Transaction, { status: 'complete' }> {
  const parsed = parseTransaction({
    id: transactionId,
    accountId: bank.accountId,
    direction: 'expense',
    adjustmentEffect: null,
    amount: 125_000,
    categoryId,
    quality: 'need',
    payer: { kind: 'contact', contactId: '55555555-5555-4555-8555-555555555555' },
    occurredAt: new Date(2026, 8, 15, 12, 30),
    status: 'complete',
    photoKey: 'receipt.jpg',
    note: null,
    sourceLabel: null,
    createdAt: new Date(2026, 8, 15, 12, 30),
    updatedAt: new Date(2026, 8, 15, 12, 30),
    deletedAt: null,
  });
  if (parsed.status !== 'complete') throw new Error('Expected complete fixture');
  return parsed;
}

test('creation defaults to the sole active default bank without preselecting optional fields', () => {
  const initialized = initializeCreationForm(
    { kind: 'manual', initialDirection: 'expense' },
    [bank, cash],
    now
  );
  assert.deepEqual(initialized, {
    status: 'ready',
    values: {
      amount: '',
      date: '2026-09-15',
      note: '',
      sourceLabel: '',
      direction: 'expense',
      accountId: bank.accountId,
      categoryId: null,
      quality: null,
    },
  });
  assert.equal(
    initializeCreationForm(
      { kind: 'manual', initialDirection: 'income' },
      [cash],
      now
    ).status,
    'error'
  );
  assert.equal(
    initializeCreationForm(
      { kind: 'manual', initialDirection: 'income' },
      [bank, { ...bank, accountId: cash.accountId }],
      now
    ).status,
    'error'
  );
});

test('reserve payment creation fixes expense and leaf while keeping the amount blank', () => {
  const intent = {
    kind: 'reserve-payment' as const,
    categoryId,
    period: '2026-09' as const,
  };
  expect(initializeCreationForm(intent, [bank, cash], now)).toEqual({
    status: 'ready',
    values: {
      amount: '',
      date: '2026-09-15',
      note: '',
      sourceLabel: '',
      direction: 'expense',
      accountId: bank.accountId,
      categoryId,
      quality: null,
    },
  });

  const outside = validateCreationTransactionForm(
    values({ date: '2026-08-31' }),
    intent,
    now,
    now
  );
  expect(outside).toEqual({
    valid: false,
    errors: {
      date: 'Payment date must belong to the selected commitment period.',
    },
  });
  expect(
    validateCreationTransactionForm(values(), intent, now, now).valid
  ).toBe(true);
});

test('editor initialization preserves known and unknown values', () => {
  const current = transaction();
  const initialized = initializeEditorForm(current);
  assert.deepEqual(initialized, values({ quality: 'need' }));

  const draft = parseTransaction({
    ...current,
    status: 'draft',
    amount: null,
    categoryId: null,
    quality: null,
  });
  assert.deepEqual(initializeEditorForm(draft), values({ amount: '', categoryId: null }));
});

test('direction transitions clear fields that the new direction cannot carry', () => {
  const income = transitionDirection(values({ sourceLabel: 'Salary' }), 'income');
  assert.equal(income.categoryId, null);
  assert.equal(income.sourceLabel, 'Salary');

  const expense = transitionDirection(income, 'expense');
  assert.equal(expense.categoryId, null);
  assert.equal(expense.sourceLabel, '');
});

test('validation checks whole-dong bounds, local dates, account, and leaf fields', () => {
  const valid = validateTransactionForm(values(), 'complete', now, now);
  assert.equal(valid.valid, true);
  if (!valid.valid) throw new Error('Expected valid form');
  assert.equal(valid.amount, 125_000);
  assert.equal(valid.occurredAt.getHours(), now.getHours());

  const invalid = validateTransactionForm(
    values({ amount: '9007199254740992', date: '2026-09-16', categoryId: null }),
    'complete',
    now,
    now
  );
  assert.equal(invalid.valid, false);
  if (invalid.valid) throw new Error('Expected invalid form');
  assert.equal(invalid.errors.amount, 'Enter a positive whole-dong amount.');
  assert.match(invalid.errors.date ?? '', /future/i);
  assert.equal(invalid.errors.leaf, 'Select a leaf category.');

  const blankDraft = validateTransactionForm(
    values({ amount: '', categoryId: null }),
    'draft',
    now,
    now
  );
  assert.equal(blankDraft.valid, true);
  if (blankDraft.valid) assert.equal(blankDraft.amount, null);
});

test('create payload trims optional text and fixes manual-only metadata', () => {
  const form = values({
    direction: 'income',
    sourceLabel: '  salary  ',
    note: '  received  ',
    categoryId: null,
    quality: 'want',
  });
  const validation = validateTransactionForm(form, 'create', now, now);
  if (!validation.valid) throw new Error('Expected valid income form');
  assert.deepEqual(buildCompleteCreatePayload(form, validation), {
    status: 'complete',
    amount: 125_000,
    accountId: bank.accountId,
    direction: 'income',
    adjustmentEffect: null,
    categoryId: null,
    quality: 'want',
    payer: { kind: 'you' },
    photoKey: null,
    occurredAt: validation.occurredAt,
    note: 'received',
    sourceLabel: 'salary',
  });
});

test('changed fields omit unchanged categories and hidden capture metadata', () => {
  const current = transaction();
  const form = values({ note: '  fixed  ', quality: 'want' });
  const validation = validateTransactionForm(form, 'complete', current.occurredAt, now);
  if (!validation.valid) throw new Error('Expected valid edit form');
  assert.deepEqual(buildEditChanges(current, form, validation), {
    quality: 'want',
    note: 'fixed',
  });
});

test('completion payload keeps only completion-visible changes', () => {
  const current = parseTransaction({
    ...transaction(),
    status: 'draft',
    amount: null,
    categoryId: null,
    quality: null,
  });
  const form = values({ amount: '50000', quality: null });
  const validation = validateTransactionForm(form, 'complete', current.occurredAt, now);
  if (!validation.valid) throw new Error('Expected valid completion form');
  assert.deepEqual(buildCompleteDraftPayload(current, form, validation), {
    transactionId,
    amount: 50_000,
    categoryId,
    changes: {},
  });
});
