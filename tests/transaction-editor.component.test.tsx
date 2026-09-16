import { act, cleanup, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import type { ActiveAccount } from '../src/data/accounts';
import type { CategoryGroupWithLeaves } from '../src/data/category-types';
import {
  parseTransaction,
  type Transaction,
} from '../src/data/transaction-validation';
import { TransactionEditor } from '../src/ui/transactions/TransactionEditor';
import type { TransactionEditorData } from '../src/ui/transactions/transaction-editor-contract';

const transactionId = '11111111-1111-4111-8111-111111111111';
const bankId = '22222222-2222-4222-8222-222222222222';
const categoryId = '33333333-3333-4333-8333-333333333333';
const groupId = '44444444-4444-4444-8444-444444444444';
const occurredAt = new Date(2026, 0, 12, 10, 30);

function complete(overrides: Partial<Extract<Transaction, { status: 'complete' }>> = {}): Extract<Transaction, { status: 'complete' }> {
  const transaction = parseTransaction({
    id: transactionId,
    accountId: bankId,
    direction: 'expense',
    adjustmentEffect: null,
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
  });
  if (transaction.status !== 'complete') {
    throw new Error('Expected a complete transaction fixture');
  }
  return transaction;
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
    createCategory: jest.fn(),
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

  expect(screen.getByText('Enter a positive whole-dong amount.')).toBeTruthy();
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

test('shows future-date feedback at the Date field before writing', async () => {
  const data = editorData();
  const user = userEvent.setup();
  await render(
    <TransactionEditor
      transaction={complete()}
      groups={groups}
      accounts={accounts}
      data={data}
      onDone={jest.fn()}
      now={() => new Date(2026, 0, 12, 10)}
    />
  );

  await user.clear(screen.getByLabelText('Date'));
  await user.type(screen.getByLabelText('Date'), '2026-01-13');
  await user.press(screen.getByRole('button', { name: 'Save transaction' }));

  expect(screen.getByText('Manual transaction date cannot be in the future')).toBeTruthy();
  expect(data.editTransaction).not.toHaveBeenCalled();
});

test('direction changes clear forbidden visible fields', async () => {
  const data = editorData();
  const user = userEvent.setup();
  await render(
    <TransactionEditor
      transaction={complete()}
      groups={groups}
      accounts={accounts}
      data={data}
      onDone={jest.fn()}
    />
  );

  await user.press(screen.getByRole('button', { name: 'income' }));
  expect(screen.queryByText('Leaf')).toBeNull();
  expect(screen.getByLabelText('Source').props.value).toBe('');
  await user.type(screen.getByLabelText('Source'), 'Imported');
  await user.press(screen.getByRole('button', { name: 'expense' }));
  expect(screen.queryByLabelText('Source')).toBeNull();
});

test('failed edits retain every visible value', async () => {
  const data = editorData();
  data.editTransaction = jest.fn(async () => {
    throw new Error('Ledger unavailable');
  });
  const user = userEvent.setup();
  await render(
    <TransactionEditor
      transaction={complete()}
      groups={groups}
      accounts={accounts}
      data={data}
      onDone={jest.fn()}
    />
  );

  await user.clear(screen.getByLabelText('Amount'));
  await user.type(screen.getByLabelText('Amount'), '130000');
  await user.type(screen.getByLabelText('Note'), 'Keep this');
  await user.press(screen.getByRole('button', { name: 'Save transaction' }));
  await waitFor(() => expect(screen.getByText('Ledger unavailable')).toBeTruthy());
  expect(screen.getByLabelText('Amount').props.value).toBe('130000');
  expect(screen.getByLabelText('Note').props.value).toBe('Keep this');
});

test('two immediate save events issue one edit', async () => {
  let resolveEdit: () => void = () => undefined;
  const editPromise = new Promise<Extract<Transaction, { status: 'complete' }>>((resolve) => {
    resolveEdit = () => resolve(complete());
  });
  const data = editorData();
  data.editTransaction = jest.fn(() => editPromise);
  const view = await render(
    <TransactionEditor
      transaction={complete()}
      groups={groups}
      accounts={accounts}
      data={data}
      onDone={jest.fn()}
    />
  );
  const save = view.getByRole('button', { name: 'Save transaction' });

  await fireEvent.press(save);
  await fireEvent.press(save);
  expect(data.editTransaction).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolveEdit();
    await editPromise;
  });
  await waitFor(() => expect(data.editTransaction).toHaveBeenCalledTimes(1));
});

test('preserves transaction input while creating and refreshing a leaf', async () => {
  const createdLeaf: CategoryGroupWithLeaves['leaves'][number] = {
    level: 'leaf',
    id: '33333333-3333-4333-8333-333333333334',
    name: 'Market',
    sort: 1,
    kind: 'spend',
    isSuggestion: false,
    deletedAt: null,
    group: {
      level: 'group',
      id: groupId,
      name: 'Food',
      sort: 0,
      kind: 'spend',
    },
  };
  const refreshedGroups: CategoryGroupWithLeaves[] = [{
    ...groups[0]!,
    leaves: [...groups[0]!.leaves, createdLeaf],
  }];
  const data = editorData();
  data.createCategory = jest.fn(async () => createdLeaf);
  data.listActiveCategoryGroups = jest.fn(async () => refreshedGroups);
  const user = userEvent.setup();
  await render(
    <TransactionEditor
      transaction={draft()}
      groups={groups}
      accounts={accounts}
      data={data}
      onDone={jest.fn()}
      now={() => new Date(2026, 0, 12, 11)}
    />
  );

  await user.type(screen.getByLabelText('Amount'), '45001');
  await user.type(screen.getByLabelText('Note'), 'Keep this');
  await user.press(screen.getByRole('button', { name: 'want' }));
  await user.type(screen.getByLabelText('Search leaves'), 'gro');
  await user.press(screen.getByRole('button', { name: 'New leaf' }));
  await user.type(screen.getByLabelText('Leaf name'), 'Market');
  await user.press(screen.getByRole('button', { name: 'Food' }));
  await user.press(screen.getByRole('button', { name: 'Create leaf' }));

  await waitFor(() => expect(screen.queryByTestId('inline-category-creator')).toBeNull());
  expect(data.createCategory).toHaveBeenCalledWith({
    level: 'leaf',
    name: 'Market',
    groupId,
  });
  expect(data.listActiveCategoryGroups).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Amount').props.value).toBe('45001');
  expect(screen.getByLabelText('Note').props.value).toBe('Keep this');
  expect(screen.getByLabelText('Date').props.value).toBe('2026-01-12');
  expect(screen.getByRole('button', { name: 'want' }).props.accessibilityState.selected).toBe(true);
  expect(screen.getByLabelText('Search leaves').props.value).toBe('');
  expect(screen.getByRole('button', { name: 'Market' }).props.accessibilityState.selected).toBe(true);
});
