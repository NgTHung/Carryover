import { cleanup, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Transaction } from '../src/data/transaction-validation';
import type { TransactionListData, TransactionListRow } from '../src/data/transaction-list';
import TransactionsScreen from '../src/app/transactions/index';
import { useTransactionFilters } from '../src/ui/transactions/transaction-filters';

jest.mock('../src/ui/ledger-access', () => ({
  getTransactionListData: jest.fn(),
  subscribeLedgerChanges: jest.fn(() => () => undefined),
}));

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

const bankId = '10000000-0000-4000-8000-000000000001';
const cashId = '10000000-0000-4000-8000-000000000002';
const categoryId = '20000000-0000-4000-8000-000000000001';
const transactionId = '30000000-0000-4000-8000-000000000001';
const unknownId = '30000000-0000-4000-8000-000000000002';

const date = new Date(2026, 0, 12, 10);

function completeTransaction(overrides: Partial<Extract<Transaction, { status: 'complete' }>> = {}): Extract<Transaction, { status: 'complete' }> {
  return {
    id: transactionId,
    accountId: bankId,
    direction: 'expense',
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
  };
}

function draftTransaction(): Extract<Transaction, { status: 'draft' }> {
  return {
    ...completeTransaction({ id: unknownId, amount: 125_000, categoryId: null, quality: null }),
    amount: null,
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

function repository(initialRows: TransactionListRow[] = rows(), readTransactionList = jest.fn(async () => initialRows)): TransactionListData<'sync'> {
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

test('shows a calm empty state', async () => {
  const data = repository([]);
  await render(<TransactionsScreen data={data} subscribe={() => () => undefined} />);
  await waitFor(() => expect(screen.getByText('No transactions in this period.')).toBeTruthy());
});

test('shows a read error and retries it', async () => {
  const readTransactionList = jest.fn()
    .mockRejectedValueOnce(new Error('Ledger unavailable'))
    .mockResolvedValue(rows());
  const failing = repository(rows(), readTransactionList);
  await render(<TransactionsScreen data={failing} subscribe={() => () => undefined} />);
  await waitFor(() => expect(screen.getByText('Ledger unavailable')).toBeTruthy());
  await userEvent.setup().press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getAllByText('Groceries').length).toBeGreaterThan(0));
});
