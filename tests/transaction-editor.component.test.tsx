import { cleanup, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import type { ActiveAccount } from '../src/data/accounts';
import type { CategoryGroupWithLeaves } from '../src/data/category-types';
import type { Transaction } from '../src/data/transaction-validation';
import { TransactionEditor } from '../src/ui/transactions/TransactionEditor';
import type { TransactionEditorData } from '../src/ui/transactions/transaction-editor-contract';

const transactionId = '11111111-1111-4111-8111-111111111111';
const bankId = '22222222-2222-4222-8222-222222222222';
const categoryId = '33333333-3333-4333-8333-333333333333';
const groupId = '44444444-4444-4444-8444-444444444444';
const occurredAt = new Date(2026, 0, 12, 10, 30);

function complete(overrides: Partial<Extract<Transaction, { status: 'complete' }>> = {}): Extract<Transaction, { status: 'complete' }> {
  return {
    id: transactionId,
    accountId: bankId,
    direction: 'expense',
    amount: 125_000,
    categoryId,
    quality: 'need',
    payer: { kind: 'you' },
    occurredAt,
    status: 'complete',
    photoKey: 'receipt.jpg',
    note: null,
    sourceLabel: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    deletedAt: null,
    ...overrides,
  };
}

function draft(): Extract<Transaction, { status: 'draft' }> {
  return { ...complete(), status: 'draft', amount: null, categoryId: null, quality: null };
}

const groups: CategoryGroupWithLeaves[] = [{
  level: 'group',
  id: groupId,
  name: 'Food',
  sort: 0,
  kind: 'spend',
  isSuggestion: false,
  deletedAt: null,
  leaves: [{
    level: 'leaf',
    id: categoryId,
    name: 'Groceries',
    sort: 0,
    kind: 'spend',
    isSuggestion: false,
    deletedAt: null,
    group: { level: 'group', id: groupId, name: 'Food', sort: 0, kind: 'spend' },
  }],
}];

const accounts: ActiveAccount[] = [{
  accountId: bankId,
  name: 'Bank',
  kind: 'bank',
  isDefault: true,
}];

function editorData(): TransactionEditorData {
  return {
    readTransaction: jest.fn(),
    listActiveCategoryGroups: jest.fn(),
    listActiveAccounts: jest.fn(),
    editTransaction: jest.fn(async () => complete()),
    completeDraft: jest.fn(async () => complete()),
    softDeleteTransaction: jest.fn(async () => undefined),
  };
}

afterEach(cleanup);

test('edits supported fields without rewriting hidden metadata', async () => {
  const data = editorData();
  const done = jest.fn();
  const user = userEvent.setup();
  await render(<TransactionEditor transaction={complete()} groups={groups} accounts={accounts} data={data} onDone={done} />);

  await user.clear(screen.getByLabelText('Amount'));
  await user.type(screen.getByLabelText('Amount'), '130000');
  await user.type(screen.getByLabelText('Note'), 'Lunch');
  await user.press(screen.getByRole('button', { name: 'Save transaction' }));

  await waitFor(() => expect(data.editTransaction).toHaveBeenCalledWith({
    transactionId,
    changes: { amount: 130_000, note: 'Lunch' },
  }));
  expect(done).toHaveBeenCalledTimes(1);
});

test('completes a draft atomically when amount and leaf are present', async () => {
  const data = editorData();
  const user = userEvent.setup();
  await render(<TransactionEditor transaction={draft()} groups={groups} accounts={accounts} data={data} onDone={jest.fn()} />);

  await user.type(screen.getByLabelText('Amount'), '45000');
  await user.press(screen.getByRole('button', { name: 'Groceries' }));
  await user.press(screen.getByRole('button', { name: 'Complete' }));

  await waitFor(() => expect(data.completeDraft).toHaveBeenCalledWith({
    transactionId,
    amount: 45_000,
    categoryId,
    changes: {},
  }));
  expect(data.editTransaction).not.toHaveBeenCalled();
});

test('rejects fractional money before calling the data boundary', async () => {
  const data = editorData();
  const user = userEvent.setup();
  await render(<TransactionEditor transaction={complete()} groups={groups} accounts={accounts} data={data} onDone={jest.fn()} />);

  await user.clear(screen.getByLabelText('Amount'));
  await user.type(screen.getByLabelText('Amount'), '12.5');
  await user.press(screen.getByRole('button', { name: 'Save transaction' }));

  expect(screen.getByText('Enter a positive whole-dong amount, or leave a draft amount blank.')).toBeTruthy();
  expect(data.editTransaction).not.toHaveBeenCalled();
});

test('soft-deletes only after inline confirmation', async () => {
  const data = editorData();
  const done = jest.fn();
  const user = userEvent.setup();
  await render(<TransactionEditor transaction={complete()} groups={groups} accounts={accounts} data={data} onDone={done} />);

  await user.press(screen.getByRole('button', { name: 'Delete' }));
  expect(data.softDeleteTransaction).not.toHaveBeenCalled();
  await user.press(screen.getByRole('button', { name: 'Delete transaction' }));

  await waitFor(() => expect(data.softDeleteTransaction).toHaveBeenCalledWith(transactionId));
  expect(done).toHaveBeenCalledTimes(1);
});
