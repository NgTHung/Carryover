import { act, cleanup, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import {
  parseTransaction,
  type Transaction,
} from '../src/data/transaction-validation';
import type { TransactionListData, TransactionListRow } from '../src/data/transaction-list';
import TransactionsScreen from '../src/app/transactions/index';
import { useTransactionFilters } from '../src/ui/transactions/transaction-filters';

jest.mock('../src/ui/ledger-access', () => ({
  getTransactionListData: jest.fn(),
  subscribeLedgerChanges: jest.fn(() => () => undefined),
}));

const mockNavigate = jest.fn();

jest.mock('expo-router', () => ({
  Link: ({ children, href }: { children: import('react').ReactElement; href: string }) =>
    require('react').cloneElement(children, { onPress: () => mockNavigate(href) }),
}));

const bankId = '10000000-0000-4000-8000-000000000001';
const cashId = '10000000-0000-4000-8000-000000000002';
const categoryId = '20000000-0000-4000-8000-000000000001';
const transactionId = '30000000-0000-4000-8000-000000000001';
const unknownId = '30000000-0000-4000-8000-000000000002';

const date = new Date(2026, 0, 12, 10);

function completeTransaction(overrides: Partial<Extract<Transaction, { status: 'complete' }>> = {}): Extract<Transaction, { status: 'complete' }> {
  const transaction = parseTransaction({
    id: transactionId,
    accountId: bankId,
    direction: 'expense',
    adjustmentEffect: null,
    amount: 125_000,
    categoryId,
    quality: 'need',
    payer: { kind: 'you' },
    occurredAt: date,
    status: 'complete',
    photoKey: null,
    note: null,
    sourceLabel: null,
    createdAt: date,
    updatedAt: date,
    deletedAt: null,
    ...overrides,
  });
  if (transaction.status !== 'complete') {
    throw new Error('Expected a complete transaction fixture');
  }
  return transaction;
}

function draftTransaction(): Extract<Transaction, { status: 'draft' }> {
  return {
    ...completeTransaction({ id: unknownId, amount: 125_000 }),
    amount: null,
    categoryId: null,
    quality: null,
    status: 'draft',
  };
}

function rows(): TransactionListRow[] {
  return [
    {
      kind: 'transaction',
      transaction: completeTransaction(),
      account: { id: bankId, name: 'Bank', kind: 'bank' },
      category: { id: categoryId, name: 'Groceries', group: { id: '40000000-0000-4000-8000-000000000001', name: 'Food' } },
    },
    {
      kind: 'transaction',
      transaction: draftTransaction(),
      account: { id: cashId, name: 'Cash', kind: 'cash' },
      category: null,
    },
  ];
}

function transferRow(): TransactionListRow {
  return {
    kind: 'transfer',
    source: 'transfers',
    transfer: { id: '50000000-0000-4000-8000-000000000001', amount: 50_000, occurredAt: date, createdAt: date },
    fromAccount: { id: bankId, name: 'Bank', kind: 'bank' },
    toAccount: { id: cashId, name: 'Cash', kind: 'cash' },
  };
}

function adjustmentRow(): TransactionListRow {
  return {
    kind: 'transaction',
    transaction: completeTransaction({
      id: '60000000-0000-4000-8000-000000000001',
      direction: 'adjustment',
      adjustmentEffect: 'increase',
      amount: 50_000,
      categoryId: null,
      quality: null,
    }),
    account: { id: bankId, name: 'Bank', kind: 'bank' },
    category: null,
  };
}

function repository(
  initialRows: TransactionListRow[] = rows(),
  readTransactionList: TransactionListData<'sync'>['readTransactionList'] = jest.fn(async () => initialRows)
): TransactionListData<'sync'> {
  return {
    readTransactionList,
    subscribeToChanges: jest.fn(() => () => undefined),
  };
}

beforeEach(() => {
  useTransactionFilters.setState({
    selectedPeriod: '2026-01',
    categoryId: null,
    accountId: null,
    quality: null,
  });
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

test('renders amounts, metadata, and an explicit unknown draft amount', async () => {
  await render(<TransactionsScreen data={repository()} subscribe={() => () => undefined} />);

  await waitFor(() => expect(screen.getByText('₫125.000')).toBeTruthy());
  expect(screen.getAllByText('Groceries').length).toBeGreaterThan(0);
  expect(screen.getByText('Bank · need · 12 Jan 2026')).toBeTruthy();
  expect(screen.getByText('Unknown')).toBeTruthy();
  expect(screen.getByText('Draft')).toBeTruthy();
});

test('combines leaf, account, and quality filters and can reset them', async () => {
  const data = repository();
  const user = userEvent.setup();
  await render(<TransactionsScreen data={data} subscribe={() => () => undefined} />);
  await waitFor(() => expect(screen.getAllByText('Groceries').length).toBeGreaterThan(0));

  await user.press(screen.getByRole('button', { name: 'Groceries' }));
  await user.press(screen.getByRole('button', { name: 'Bank' }));
  await user.press(screen.getByRole('button', { name: 'need' }));

  await waitFor(() => {
    expect(data.readTransactionList).toHaveBeenLastCalledWith({
      period: '2026-01',
      categoryId,
      accountId: bankId,
      quality: 'need',
    });
  });

  await user.press(screen.getByRole('button', { name: 'Reset filters' }));
  expect(useTransactionFilters.getState().categoryId).toBeNull();
  expect(useTransactionFilters.getState().accountId).toBeNull();
  expect(useTransactionFilters.getState().quality).toBeNull();
});

test('keeps filter choices visible and opens only transaction rows', async () => {
  const allRows = [...rows(), transferRow()];
  const readTransactionList = jest.fn(async (filters: { categoryId: string | null }) =>
    filters.categoryId === null ? allRows : []
  );
  const user = userEvent.setup();
  await render(
    <TransactionsScreen
      data={repository(allRows, readTransactionList)}
      subscribe={() => () => undefined}
    />
  );

  await waitFor(() => expect(screen.getAllByText('Groceries').length).toBeGreaterThan(0));
  await user.press(screen.getAllByRole('button', { name: /Open expense transaction/ })[0]);
  expect(mockNavigate).toHaveBeenCalledWith(`/transactions/${transactionId}`);
  expect(screen.queryByRole('button', { name: /Open transfer transaction/ })).toBeNull();

  await user.press(screen.getByRole('button', { name: 'Groceries' }));
  await waitFor(() => expect(screen.getByText('No transactions match these filters.')).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Groceries' })).toBeTruthy();
});

test('shows a positive adjustment distinctly and opens its read-only route', async () => {
  const adjustment = adjustmentRow();
  const user = userEvent.setup();
  await render(
    <TransactionsScreen
      data={repository([adjustment])}
      subscribe={() => () => undefined}
    />
  );

  await waitFor(() => expect(screen.getByText('₫50.000')).toBeTruthy());
  expect(screen.getByText('Balance increased')).toBeTruthy();
  const open = screen.getByRole('button', {
    name: /Open adjustment, Balance increased/,
  });
  await user.press(open);
  expect(mockNavigate).toHaveBeenCalledWith(
    '/transactions/60000000-0000-4000-8000-000000000001'
  );
});

test('reloads after an external committed ledger change', async () => {
  let listener: ((change: { table: 'transactions'; mutation: 'edited' }) => void) | undefined;
  const readTransactionList = jest.fn(async () => rows());
  await render(
    <TransactionsScreen
      data={repository(rows(), readTransactionList)}
      subscribe={(next) => {
        listener = next as typeof listener;
        return () => undefined;
      }}
    />
  );

  await waitFor(() => expect(readTransactionList).toHaveBeenCalledTimes(2));
  await act(async () => {
    listener?.({ table: 'transactions', mutation: 'edited' });
  });
  await waitFor(() => expect(readTransactionList).toHaveBeenCalledTimes(4));
});

test('shows a calm empty state', async () => {
  const data = repository([]);
  await render(<TransactionsScreen data={data} subscribe={() => () => undefined} />);
  await waitFor(() => expect(screen.getByText('No transactions in this period.')).toBeTruthy());
});

test('shows a read error and retries it', async () => {
  const readTransactionList = jest.fn()
    .mockRejectedValueOnce(new Error('Ledger unavailable'))
    .mockRejectedValueOnce(new Error('Ledger unavailable'))
    .mockResolvedValue(rows());
  const failing = repository(rows(), readTransactionList);
  await render(<TransactionsScreen data={failing} subscribe={() => () => undefined} />);
  await waitFor(() => expect(screen.getByText('Ledger unavailable')).toBeTruthy());
  await userEvent.setup().press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getAllByText('Groceries').length).toBeGreaterThan(0));
});

test('retry restores both transaction rows and filter choices', async () => {
  useTransactionFilters.setState({ categoryId });
  let filteredAttempts = 0;
  let optionAttempts = 0;
  const readTransactionList = jest.fn(async (input: { categoryId: string | null }) => {
    if (input.categoryId === null) {
      optionAttempts += 1;
      if (optionAttempts === 1) throw new Error('Options unavailable');
    } else {
      filteredAttempts += 1;
      if (filteredAttempts === 1) throw new Error('Rows unavailable');
    }
    return rows();
  });

  await render(
    <TransactionsScreen
      data={repository(rows(), readTransactionList)}
      subscribe={() => () => undefined}
    />
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy());
  await userEvent.setup().press(screen.getByRole('button', { name: 'Try again' }));

  await waitFor(() => expect(screen.getByText('₫125.000')).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Groceries' })).toBeTruthy();
  expect(filteredAttempts).toBe(2);
  expect(optionAttempts).toBe(2);
});
