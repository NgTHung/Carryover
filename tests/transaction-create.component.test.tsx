import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';

import type { ActiveAccount } from '../src/data/accounts';
import type { CategoryGroupWithLeaves } from '../src/data/category-types';
import { parseTransaction, type Transaction } from '../src/data/transaction-validation';
import { TransactionCreator } from '../src/ui/transactions/TransactionCreator';
import type { TransactionCreateData } from '../src/ui/transactions/transaction-create-contract';

const bankId = '11111111-1111-4111-8111-111111111111';
const cashId = '22222222-2222-4222-8222-222222222222';
const categoryId = '33333333-3333-4333-8333-333333333333';
const groupId = '44444444-4444-4444-8444-444444444444';
const transactionId = '55555555-5555-4555-8555-555555555555';
const openedAt = new Date(2026, 8, 15, 12, 30);

const accounts: ActiveAccount[] = [
  { accountId: bankId, name: 'Bank', kind: 'bank', isDefault: true },
  { accountId: cashId, name: 'Cash', kind: 'cash', isDefault: false },
];

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

function savedTransaction(
  direction: 'expense' | 'income' = 'expense',
  overrides: Partial<Extract<Transaction, { status: 'complete' }>> = {}
): Extract<Transaction, { status: 'complete' }> {
  const transaction = parseTransaction({
    id: transactionId,
    accountId: bankId,
    direction,
    adjustmentEffect: null,
    amount: 125_000,
    categoryId: direction === 'expense' ? categoryId : null,
    quality: null,
    payer: { kind: 'you' },
    occurredAt: openedAt,
    status: 'complete',
    photoKey: null,
    note: null,
    sourceLabel: null,
    createdAt: openedAt,
    updatedAt: openedAt,
    deletedAt: null,
    ...overrides,
  });
  if (transaction.status !== 'complete') throw new Error('Expected complete transaction');
  return transaction;
}

function createData(
  createCompleteTransaction: TransactionCreateData['createCompleteTransaction'] = jest.fn(async () => savedTransaction())
): TransactionCreateData {
  return {
    listActiveAccounts: jest.fn(async () => accounts),
    listActiveCategoryGroups: jest.fn(async () => groups),
    createCompleteTransaction,
  };
}

function renderCreator(
  direction: 'expense' | 'income',
  data: TransactionCreateData = createData(),
  overrides: Partial<React.ComponentProps<typeof TransactionCreator>> = {}
) {
  return render(
    <TransactionCreator
      direction={direction}
      accounts={accounts}
      groups={groups}
      openedAt={openedAt}
      data={data}
      onCancel={jest.fn()}
      onCommitted={jest.fn()}
      onWritePending={jest.fn()}
      now={() => openedAt}
      {...overrides}
    />
  );
}

type EventFiber = {
  memoizedProps: { onPress?: () => void } | null;
  return: EventFiber | null;
};

// Capture the old native handler because normal test events flush the saved render.
function stalePressHandler(instance: TestInstance): () => void {
  let fiber: EventFiber | null = (
    instance as unknown as { unstable_fiber: EventFiber }
  ).unstable_fiber;
  while (fiber !== null) {
    if (typeof fiber.memoizedProps?.onPress === 'function') {
      return fiber.memoizedProps.onPress;
    }
    fiber = fiber.return;
  }
  throw new Error('Expected press handler');
}

afterEach(cleanup);

test('defaults to the bank, leaves optional fields blank, and creates an expense', async () => {
  const data = createData();
  const onCommitted = jest.fn();
  const onWritePending = jest.fn();
  const user = userEvent.setup();
  await renderCreator('expense', data, { onCommitted, onWritePending });

  expect(screen.getByLabelText('Amount').props.value).toBe('');
  expect(screen.getByLabelText('Date').props.value).toBe('2026-09-15');
  expect(screen.getByLabelText('Note').props.value).toBe('');
  expect(screen.getByRole('button', { name: 'Bank' }).props.accessibilityState).toMatchObject({ selected: true });
  expect(screen.getByRole('button', { name: 'Groceries' }).props.accessibilityState).toMatchObject({ selected: false });
  expect(screen.getByRole('button', { name: 'need' }).props.accessibilityState).toMatchObject({ selected: false });

  await user.type(screen.getByLabelText('Amount'), '125000');
  await user.press(screen.getByRole('button', { name: 'Groceries' }));
  await user.press(screen.getByRole('button', { name: 'Save transaction' }));

  await waitFor(() => expect(data.createCompleteTransaction).toHaveBeenCalledWith({
    status: 'complete',
    amount: 125_000,
    accountId: bankId,
    direction: 'expense',
    adjustmentEffect: null,
    categoryId,
    quality: null,
    payer: { kind: 'you' },
    photoKey: null,
    occurredAt: openedAt,
    note: null,
    sourceLabel: null,
  }));
  expect(onCommitted).toHaveBeenCalledWith(savedTransaction());
  expect(onCommitted).toHaveBeenCalledTimes(1);
  expect(onWritePending.mock.calls.map(([pending]) => pending)).toEqual([true, false]);
  expect(screen.getByText('Transaction saved.')).toBeTruthy();
});

test('creates a minimal income without a category', async () => {
  const data = createData(jest.fn(async () => savedTransaction('income')));
  const user = userEvent.setup();
  await renderCreator('income', data);

  await user.type(screen.getByLabelText('Amount'), '500000');
  await user.press(screen.getByRole('button', { name: 'Save transaction' }));

  await waitFor(() => expect(data.createCompleteTransaction).toHaveBeenCalledWith(
    expect.objectContaining({
      amount: 500_000,
      direction: 'income',
      categoryId: null,
      sourceLabel: null,
    })
  ));
  expect(screen.queryByRole('button', { name: 'Groceries' })).toBeNull();
});

test('creates a full income and trims optional fields', async () => {
  const data = createData(jest.fn(async () => savedTransaction('income')));
  const user = userEvent.setup();
  await renderCreator('income', data);

  await user.type(screen.getByLabelText('Amount'), '750000');
  await user.type(screen.getByLabelText('Source'), '  Salary  ');
  await user.press(screen.getByRole('button', { name: 'want' }));
  await user.type(screen.getByLabelText('Note'), '  September pay  ');
  await user.press(screen.getByRole('button', { name: 'Cash' }));
  await user.press(screen.getByRole('button', { name: 'Save transaction' }));

  await waitFor(() => expect(data.createCompleteTransaction).toHaveBeenCalledWith(
    expect.objectContaining({
      amount: 750_000,
      accountId: cashId,
      quality: 'want',
      note: 'September pay',
      sourceLabel: 'Salary',
    })
  ));
});

test('shows money, leaf, invalid-date, and future-date feedback without writing', async () => {
  const data = createData();
  const user = userEvent.setup();
  await renderCreator('expense', data);

  await user.press(screen.getByRole('button', { name: 'Save transaction' }));
  expect(screen.getByText('Enter a positive whole-dong amount.')).toBeTruthy();
  expect(data.createCompleteTransaction).not.toHaveBeenCalled();

  await user.type(screen.getByLabelText('Amount'), '10000');
  await user.clear(screen.getByLabelText('Date'));
  await user.type(screen.getByLabelText('Date'), '2026-09-14');
  await user.press(screen.getByRole('button', { name: 'Save transaction' }));
  expect(screen.getByText('Select a leaf category.')).toBeTruthy();

  await user.press(screen.getByRole('button', { name: 'Groceries' }));
  await user.clear(screen.getByLabelText('Date'));
  await user.type(screen.getByLabelText('Date'), '2026-09-16');
  await user.press(screen.getByRole('button', { name: 'Save transaction' }));
  expect(screen.getByText('Manual transaction date cannot be in the future')).toBeTruthy();
  expect(data.createCompleteTransaction).not.toHaveBeenCalled();
});

test('keeps every field after a failed write and allows retry', async () => {
  const createCompleteTransaction = jest.fn()
    .mockRejectedValueOnce(new Error('Ledger unavailable'))
    .mockResolvedValue(savedTransaction());
  const data = createData(createCompleteTransaction);
  const user = userEvent.setup();
  const onCommitted = jest.fn();
  await renderCreator('expense', data, { onCommitted });

  await user.type(screen.getByLabelText('Amount'), '10000');
  await user.press(screen.getByRole('button', { name: 'Groceries' }));
  await user.type(screen.getByLabelText('Note'), 'Keep this');
  await user.press(screen.getByRole('button', { name: 'Save transaction' }));
  await waitFor(() => expect(screen.getByText('Ledger unavailable')).toBeTruthy());
  expect(screen.getByLabelText('Amount').props.value).toBe('10000');
  expect(screen.getByLabelText('Note').props.value).toBe('Keep this');

  await user.press(screen.getByRole('button', { name: 'Save transaction' }));
  await waitFor(() => expect(onCommitted).toHaveBeenCalledTimes(1));
  expect(createCompleteTransaction).toHaveBeenCalledTimes(2);
});

test('cancel does not mutate and is disabled for the pending write', async () => {
  let resolveCreate: (transaction: Extract<Transaction, { status: 'complete' }>) => void = () => undefined;
  const createPromise = new Promise<Extract<Transaction, { status: 'complete' }>>((resolve) => {
    resolveCreate = resolve;
  });
  const onCancel = jest.fn();
  const data = createData(jest.fn(() => createPromise));
  const user = userEvent.setup();
  await renderCreator('expense', data, { onCancel });

  await user.type(screen.getByLabelText('Amount'), '10000');
  await user.press(screen.getByRole('button', { name: 'Groceries' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save transaction' }));
  expect(screen.getByRole('button', { name: 'Cancel' }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByLabelText('Amount').props.editable).toBe(false);
  expect(screen.getByRole('button', { name: 'Groceries' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).not.toHaveBeenCalled();

  await act(async () => {
    resolveCreate(savedTransaction());
    await createPromise;
  });
});

test('two immediate submit events create once and commit once', async () => {
  let resolveCreate: (transaction: Extract<Transaction, { status: 'complete' }>) => void = () => undefined;
  const createPromise = new Promise<Extract<Transaction, { status: 'complete' }>>((resolve) => {
    resolveCreate = resolve;
  });
  const createCompleteTransaction = jest.fn(() => createPromise);
  const data = createData(createCompleteTransaction);
  const user = userEvent.setup();
  const onCommitted = jest.fn();
  await renderCreator('expense', data, { onCommitted });

  await user.type(screen.getByLabelText('Amount'), '10000');
  await user.press(screen.getByRole('button', { name: 'Groceries' }));
  const save = screen.getByRole('button', { name: 'Save transaction' });
  await fireEvent.press(save);
  await fireEvent.press(save);
  expect(createCompleteTransaction).toHaveBeenCalledTimes(1);

  await act(async () => {
    resolveCreate(savedTransaction());
    await createPromise;
  });
  await waitFor(() => expect(onCommitted).toHaveBeenCalledTimes(1));
});

test('keeps submission locked when a stale save event follows commit', async () => {
  const createCompleteTransaction = jest.fn(async () => savedTransaction());
  const data = createData(createCompleteTransaction);
  let staleSubmit: () => void = () => undefined;
  const onCommitted = jest.fn(() => staleSubmit());
  const user = userEvent.setup();
  await renderCreator('expense', data, { onCommitted });

  await user.type(screen.getByLabelText('Amount'), '10000');
  await user.press(screen.getByRole('button', { name: 'Groceries' }));
  staleSubmit = stalePressHandler(
    screen.getByRole('button', { name: 'Save transaction' })
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Save transaction' }));

  await waitFor(() => expect(screen.getByText('Transaction saved.')).toBeTruthy());
  expect(createCompleteTransaction).toHaveBeenCalledTimes(1);
  expect(onCommitted).toHaveBeenCalledTimes(1);
});

test('updates the creation heading when direction changes', async () => {
  const user = userEvent.setup();
  await renderCreator('income');

  expect(screen.getByRole('header', { name: 'Add income' })).toBeTruthy();
  await user.press(screen.getByRole('button', { name: 'expense' }));
  expect(screen.getByRole('header', { name: 'Add expense' })).toBeTruthy();
});

test('reports an explicit error when no default bank is available', async () => {
  await renderCreator('expense', createData(), { accounts: [{ ...accounts[1], isDefault: false }] });
  expect(screen.getByText('Choose one active default bank account before creating a transaction.')).toBeTruthy();
  expect(screen.queryByLabelText('Amount')).toBeNull();
});
