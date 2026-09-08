import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import { ExpoRoot } from 'expo-router';
import { getMockContext } from 'expo-router/testing-library';

import type { Transaction } from '../src/data/transaction-validation';

const transactionId = '11111111-1111-4111-8111-111111111111';
const mockUseMigrations = jest.fn();
const mockReadTransaction = jest.fn();

jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: (...args: unknown[]) => mockUseMigrations(...args),
}));

jest.mock('../src/data/database', () => ({
  ledgerDb: {},
  ledgerMigrations: {},
  transactionData: {
    readTransaction: (...args: unknown[]) => mockReadTransaction(...args),
  },
}));

jest.mock('../src/screens/diagnostics/runtime-diagnostics', () => ({
  readSigningFacts: () => 'Signing facts are unavailable in router tests.',
  pushFixtureToWidget: jest.fn(),
}));

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

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

beforeEach(() => {
  mockUseMigrations.mockReturnValue({ success: true, error: undefined });
  mockReadTransaction.mockResolvedValue(transaction);
});

test('opens a transaction URL and provides a reliable route home', async () => {
  const view = await render(
    <ExpoRoot
      context={getMockContext('./src/app')}
      location={`/transactions/${transactionId}`}
    />
  );

  await waitFor(() => expect(view.getByText('Transaction loaded')).toBeTruthy());
  expect(mockReadTransaction).toHaveBeenCalledWith(transactionId);

  await act(async () => {
    fireEvent.press(view.getByText('Back to home'));
  });

  await waitFor(() => expect(view.getByText('Signing facts unavailable')).toBeTruthy());
});

test('keeps a direct transaction URL behind the migration gate', async () => {
  mockUseMigrations.mockReturnValue({ success: false, error: undefined });

  const view = await render(
    <ExpoRoot
      context={getMockContext('./src/app')}
      location={`/transactions/${transactionId}`}
    />
  );

  expect(view.getByText('Applying the ledger schema…')).toBeTruthy();
  expect(mockReadTransaction).not.toHaveBeenCalled();
});

test('recovers from an unknown URL through the real router', async () => {
  const view = await render(
    <ExpoRoot context={getMockContext('./src/app')} location="/not-a-route" />
  );

  expect(view.getByText('Page not found')).toBeTruthy();

  await act(async () => {
    fireEvent.press(view.getByText('Back to home'));
  });

  await waitFor(() => expect(view.getByText('Signing facts unavailable')).toBeTruthy());
});
