import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import { ExpoRoot, router } from 'expo-router';
import { getMockContext } from 'expo-router/testing-library';

import type { Transaction } from '../src/data/transaction-validation';
import { FIXTURE_MONTH_SUMMARY } from '../src/reports/month-summary-fixture';

const transactionId = '11111111-1111-4111-8111-111111111111';
const mockUseMigrations = jest.fn();
const mockReadTransaction = jest.fn();
const mockListCategories = jest.fn();
const mockReadAccounts = jest.fn();
const mockReadAccountBalances = jest.fn();
const mockReadMonthSummary = jest.fn();
const mockReadCommitmentOverview = jest.fn();
const mockReadActiveDrafts = jest.fn();
const mockSoftDeleteTransaction = jest.fn();

jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: (...args: unknown[]) => mockUseMigrations(...args),
}));

jest.mock('../src/data/database', () => ({
  ledgerDb: {},
  ledgerMigrations: {},
  ledgerChangeNotifier: { subscribe: jest.fn(() => () => undefined) },
  readCommittedBudgetInput: jest.fn(async () => {
    throw new Error('Snapshot input is unavailable in router tests.');
  }),
  readCommittedMonthSummary: (...args: unknown[]) => mockReadMonthSummary(...args),
  transactionData: {
    readTransaction: (...args: unknown[]) => mockReadTransaction(...args),
    editTransaction: jest.fn(),
    completeDraft: jest.fn(),
    softDeleteTransaction: jest.fn(),
  },
  draftInboxData: {
    readActiveDrafts: (...args: unknown[]) => mockReadActiveDrafts(...args),
  },
  capturedDraftData: {
    createCapturedDraft: jest.fn(),
  },
  accountData: {
    listActiveAccounts: (...args: unknown[]) => mockReadAccounts(...args),
    readAccountBalances: (...args: unknown[]) => mockReadAccountBalances(...args),
    reconcileAccount: jest.fn(),
  },
  categoryData: {
    listActiveCategoryGroups: (...args: unknown[]) => mockListCategories(...args),
    createCategory: jest.fn(),
    renameCategory: jest.fn(),
    setCategoryGroupKind: jest.fn(),
    reorderCategories: jest.fn(),
    softDeleteCategory: jest.fn(),
    deleteSuggestedCategories: jest.fn(),
  },
  commitmentData: {
    readCommitmentOverview: (...args: unknown[]) => mockReadCommitmentOverview(...args),
    createCommitment: jest.fn(),
    editCommitment: jest.fn(),
    softDeleteCommitment: jest.fn(),
  },
  manualTransactionData: {
    createTransaction: jest.fn(),
    editTransaction: jest.fn(),
    completeDraft: jest.fn(),
    softDeleteTransaction: (...args: unknown[]) => mockSoftDeleteTransaction(...args),
  },
}));

jest.mock('../src/ui/notifications/DraftNudgeLifecycle', () => ({
  DraftNudgeLifecycle: () => null,
}));

jest.mock('../src/ui/notifications/DraftNudgeControl', () => ({
  DraftNudgeControl: () => null,
}));

jest.mock('../src/ui/QualityChip', () => ({
  QualityChip: ({ quality }: { quality: string }) => {
    const { Text } = require('react-native');
    return <Text>{quality}</Text>;
  },
}));

const transaction: Transaction = {
  id: transactionId,
  accountId: '22222222-2222-4222-8222-222222222222',
  direction: 'expense',
  adjustmentEffect: null,
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
  mockListCategories.mockResolvedValue([]);
  mockReadAccounts.mockResolvedValue([]);
  mockReadAccountBalances.mockResolvedValue([
    {
      accountId: '22222222-2222-4222-8222-222222222222',
      name: 'Bank',
      kind: 'bank',
      isDefault: true,
      openingBalance: 0,
      balance: 0,
    },
  ]);
  mockReadMonthSummary.mockResolvedValue(FIXTURE_MONTH_SUMMARY);
  mockReadCommitmentOverview.mockResolvedValue({
    period: '2026-09',
    unpaidTotal: { status: 'available', amount: 0 },
    items: [],
  });
  mockReadActiveDrafts.mockResolvedValue([transaction]);
  mockSoftDeleteTransaction.mockResolvedValue(undefined);
});

test('opens a transaction URL and provides a reliable route home', async () => {
  const view = await render(
    <ExpoRoot
      context={getMockContext('./src/app')}
      location={`/transactions/${transactionId}`}
    />
  );

  await waitFor(() => expect(view.getByText('Complete draft')).toBeTruthy());
  expect(mockReadTransaction).toHaveBeenCalledWith(transactionId);
  expect(mockReadAccounts).toHaveBeenCalledTimes(1);

  await act(async () => {
    fireEvent.press(view.getByText('Back to home'));
  });

  await waitFor(() => expect(view.getByText('Per day unavailable')).toBeTruthy());
});

test('returns from a draft edit without stacking another inbox', async () => {
  const view = await render(
    <ExpoRoot context={getMockContext('./src/app')} location="/" />
  );
  await waitFor(() => expect(view.getByText('Per day unavailable')).toBeTruthy());

  await act(async () => {
    fireEvent.press(view.getByText('Drafts'));
  });
  await waitFor(() =>
    expect(view.getByTestId(`draft-row-${transactionId}`)).toBeTruthy()
  );

  await act(async () => {
    fireEvent.press(view.getByTestId(`draft-row-${transactionId}`));
  });
  await waitFor(() => expect(view.getByText('Complete draft')).toBeTruthy());
  await act(async () => {
    fireEvent.press(view.getByRole('button', { name: 'Delete' }));
  });
  await act(async () => {
    fireEvent.press(view.getByRole('button', { name: 'Delete transaction' }));
  });
  await waitFor(() => expect(view.getByTestId('draft-inbox')).toBeTruthy());

  await act(async () => {
    router.back();
  });
  await waitFor(() =>
    expect(view.getByRole('header', { name: 'Home' })).toBeTruthy()
  );
  expect(mockSoftDeleteTransaction).toHaveBeenCalledWith(transactionId);
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

test('keeps a direct creation URL behind the migration gate', async () => {
  mockUseMigrations.mockReturnValue({ success: false, error: undefined });

  const view = await render(
    <ExpoRoot
      context={getMockContext('./src/app')}
      location="/transactions/new?direction=income"
    />
  );

  expect(view.getByText('Applying the ledger schema…')).toBeTruthy();
  expect(mockReadAccounts).not.toHaveBeenCalled();
  expect(mockListCategories).not.toHaveBeenCalled();
});

test('opens the month summary route through the real router', async () => {
  const view = await render(
    <ExpoRoot context={getMockContext('./src/app')} location="/summary" />
  );

  await waitFor(() => expect(view.getByText('Spend by group')).toBeTruthy());
  expect(mockReadMonthSummary).toHaveBeenCalled();
});

test('recovers from an unknown URL through the real router', async () => {
  const view = await render(
    <ExpoRoot context={getMockContext('./src/app')} location="/not-a-route" />
  );

  expect(view.getByText('Page not found')).toBeTruthy();

  await act(async () => {
    fireEvent.press(view.getByText('Back to home'));
  });

  await waitFor(() => expect(view.getByText('Per day unavailable')).toBeTruthy());
});

test('opens the category editor through the settings route', async () => {
  const view = await render(
    <ExpoRoot
      context={getMockContext('./src/app')}
      location="/settings/categories"
    />
  );

  await waitFor(() => expect(view.getByText('Groups hold leaves. Transactions use leaves only.')).toBeTruthy());
  expect(mockListCategories).toHaveBeenCalledTimes(1);
});

test('keeps the category route behind the migration gate', async () => {
  mockUseMigrations.mockReturnValue({ success: false, error: undefined });

  const view = await render(
    <ExpoRoot
      context={getMockContext('./src/app')}
      location="/settings/categories"
    />
  );

  expect(view.getByText('Applying the ledger schema…')).toBeTruthy();
  expect(mockListCategories).not.toHaveBeenCalled();
});

test('opens commitments through the settings route', async () => {
  const view = await render(
    <ExpoRoot
      context={getMockContext('./src/app')}
      location="/settings/commitments?period=2026-09"
    />
  );

  await waitFor(() => expect(view.getByText('No commitments yet.')).toBeTruthy());
  expect(mockReadCommitmentOverview).toHaveBeenCalledWith('2026-09');
});

test('keeps commitments behind the migration gate', async () => {
  mockUseMigrations.mockReturnValue({ success: false, error: undefined });
  const view = await render(
    <ExpoRoot
      context={getMockContext('./src/app')}
      location="/settings/commitments?period=2026-09"
    />
  );

  expect(view.getByText('Applying the ledger schema…')).toBeTruthy();
  expect(mockReadCommitmentOverview).not.toHaveBeenCalled();
});

test('opens accounts and reconcile through the settings route', async () => {
  const view = await render(
    <ExpoRoot
      context={getMockContext('./src/app')}
      location="/settings/accounts"
    />
  );

  await waitFor(() =>
    expect(
      view.getByText("What's actually in your bank account?")
    ).toBeTruthy()
  );
  expect(mockReadAccountBalances).toHaveBeenCalledTimes(1);
});

test('keeps accounts and reconcile behind the migration gate', async () => {
  mockUseMigrations.mockReturnValue({ success: false, error: undefined });

  const view = await render(
    <ExpoRoot
      context={getMockContext('./src/app')}
      location="/settings/accounts"
    />
  );

  expect(view.getByText('Applying the ledger schema…')).toBeTruthy();
  expect(mockReadAccountBalances).not.toHaveBeenCalled();
});
