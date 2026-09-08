import type { ReactNode } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react-native';

import type { Transaction } from '../src/data/transaction-validation';

const transactionId = '11111111-1111-4111-8111-111111111111';
const mockUseLocalSearchParams = jest.fn();
const mockReadTransaction = jest.fn();

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useLocalSearchParams: (...args: unknown[]) => mockUseLocalSearchParams(...args),
}));

jest.mock('../src/data/database', () => ({
  transactionData: { readTransaction: (...args: unknown[]) => mockReadTransaction(...args) },
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

import NativeTransactionRoute from '../src/screens/TransactionRouteScreen';
import WebTransactionRoute from '../src/screens/TransactionRouteScreen.web';
import NotFoundScreen from '../src/screens/NotFoundScreen';

const transaction: Transaction = {
  id: transactionId,
  accountId: '22222222-2222-4222-8222-222222222222',
  direction: 'expense',
  amount: null,
  categoryId: null,
  quality: null,
  payer: { kind: 'you' },
  occurredAt: new Date(1735689600000),
  status: 'draft',
  photoKey: null,
  note: null,
  sourceLabel: null,
  createdAt: new Date(1735689600000),
  updatedAt: new Date(1735689600000),
  deletedAt: null,
};

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

test('native transaction route validates before reading and renders the loaded status', async () => {
  mockUseLocalSearchParams.mockReturnValue({ transactionId });
  mockReadTransaction.mockResolvedValue(transaction);

  const view = await render(<NativeTransactionRoute />);

  await waitFor(() => expect(mockReadTransaction).toHaveBeenCalledWith(transactionId));
  await waitFor(() => expect(view.getByText('Transaction loaded')).toBeTruthy());
  expect(view.getByText('Status: draft')).toBeTruthy();
});

test('native transaction route shows invalid links without reading the ledger', async () => {
  mockUseLocalSearchParams.mockReturnValue({ transactionId: 'not-a-uuid' });

  const view = await render(<NativeTransactionRoute />);

  expect(view.getByText('Invalid transaction link')).toBeTruthy();
  expect(mockReadTransaction).not.toHaveBeenCalled();
});

test('web transaction route keeps the ledger boundary explicit', async () => {
  mockUseLocalSearchParams.mockReturnValue({ transactionId });

  const view = await render(<WebTransactionRoute />);

  expect(view.getByText('Transaction unavailable')).toBeTruthy();
  expect(view.getByText('The browser preview does not open the ledger.')).toBeTruthy();
  expect(mockReadTransaction).not.toHaveBeenCalled();
});

test('unknown routes provide a link back to home', async () => {
  const view = await render(<NotFoundScreen />);

  expect(view.getByText('Page not found')).toBeTruthy();
  expect(view.getByText('Back to home')).toBeTruthy();
});
