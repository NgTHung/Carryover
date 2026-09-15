import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { CreateTransactionInput, Transaction } from '../src/data/transaction-validation';
import type { CommitmentOverview } from '../src/data/commitment-overview';
import NativeNewTransactionRoute from '../src/app/transactions/new';
import WebNewTransactionRoute from '../src/app/transactions/new.web';
import type { TransactionCreateData } from '../src/ui/transactions/transaction-create-contract';
import { useTransactionFilters } from '../src/ui/transactions/transaction-filters';

const transactionId = '11111111-1111-4111-8111-111111111111';
const commitmentId = '33333333-3333-4333-8333-333333333333';
const reserveLeafId = '44444444-4444-4444-8444-444444444444';
const mockUseLocalSearchParams = jest.fn();
const mockReadTransaction = jest.fn();
const mockListCategories = jest.fn(async () => []);
const mockReadAccounts = jest.fn(async () => [
  {
    accountId: '22222222-2222-4222-8222-222222222222',
    name: 'Bank',
    kind: 'bank' as const,
    isDefault: true,
  },
]);
const mockReplace = jest.fn();
const mockCreateTransaction = jest.fn<Promise<Transaction>, [CreateTransactionInput]>();
const mockCreateReservePayment = jest.fn<Promise<Transaction>, [unknown]>();
const mockReadCommitmentOverview = jest.fn<Promise<CommitmentOverview>, [unknown]>();
const mockUsePreventRemove = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => false);

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack(),
  },
  useLocalSearchParams: (...args: unknown[]) => mockUseLocalSearchParams(...args),
}));

jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (...args: unknown[]) => mockUsePreventRemove(...args),
}));

jest.mock('../src/data/database', () => ({
  transactionData: {
    readTransaction: (...args: unknown[]) => mockReadTransaction(...args),
    editTransaction: jest.fn(),
    completeDraft: jest.fn(),
    softDeleteTransaction: jest.fn(),
  },
  categoryData: { listActiveCategoryGroups: () => mockListCategories() },
  accountData: { listActiveAccounts: () => mockReadAccounts() },
  manualTransactionData: { createTransaction: jest.fn() },
  commitmentData: {
    readCommitmentOverview: (...args: unknown[]) =>
      mockReadCommitmentOverview(args[0]),
  },
  reservePaymentData: {
    createReservePayment: (...args: unknown[]) =>
      mockCreateReservePayment(args[0]),
  },
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

import NativeTransactionRoute from '../src/app/transactions/[transactionId]';
import WebTransactionRoute from '../src/app/transactions/[transactionId].web';
import NotFoundScreen from '../src/app/+not-found';

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

function eligibleCommitmentOverview(): CommitmentOverview {
  return {
    period: '2026-09',
    unpaidTotal: { status: 'available', amount: 700_000 },
    items: [
      {
        commitment: {
          id: commitmentId,
          name: 'Apartment rent',
          amount: 700_000,
          dueDay: 5,
          categoryId: reserveLeafId,
          active: true,
          createdAt: new Date(0),
          updatedAt: new Date(0),
          deletedAt: null,
        },
        dueDate: '2026-09-05',
        leaf: {
          id: reserveLeafId,
          name: 'Rent',
          groupName: 'Rent',
          active: true,
        },
        state: { status: 'unpaid', nextToAcceptPayment: true },
      },
    ],
  };
}

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(false);
  mockCreateTransaction.mockReset();
  mockCreateReservePayment.mockReset();
  mockReadCommitmentOverview.mockReset();
});

function creationData(): TransactionCreateData {
  return {
    listActiveAccounts: () => mockReadAccounts(),
    listActiveCategoryGroups: () => mockListCategories(),
    readCommitmentOverview: (period) => mockReadCommitmentOverview(period),
    createCompleteTransaction: (input) => mockCreateTransaction(input),
    createReservePayment: (input) => mockCreateReservePayment(input),
  };
}

test('native transaction route validates before reading and opens the editor', async () => {
  mockUseLocalSearchParams.mockReturnValue({ transactionId });
  mockReadTransaction.mockResolvedValue(transaction);

  const view = await render(<NativeTransactionRoute />);

  await waitFor(() => expect(mockReadTransaction).toHaveBeenCalledWith(transactionId));
  await waitFor(() => expect(view.getByText('Edit transaction')).toBeTruthy());
  expect(view.getByText('Draft')).toBeTruthy();
});

test('an adjustment opens a read-only detail instead of the transaction editor', async () => {
  mockUseLocalSearchParams.mockReturnValue({ transactionId });
  mockReadTransaction.mockResolvedValue({
    ...transaction,
    direction: 'adjustment',
    adjustmentEffect: 'decrease',
    amount: 50_000,
    status: 'complete',
  } satisfies Transaction);

  const view = await render(<NativeTransactionRoute />);

  await waitFor(() => expect(view.getByText('Adjustment')).toBeTruthy());
  expect(view.getByText('Balance decreased')).toBeTruthy();
  expect(view.getByText('Read-only account maintenance')).toBeTruthy();
  expect(view.queryByText('Edit transaction')).toBeNull();
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
  expect(view.getByText(/browser preview does not open the ledger/)).toBeTruthy();
  expect(mockReadTransaction).not.toHaveBeenCalled();
});

test('unknown routes provide a link back to home', async () => {
  const view = await render(<NotFoundScreen />);

  expect(view.getByText('Page not found')).toBeTruthy();
  expect(view.getByText('Back to home')).toBeTruthy();
});

test.each([
  ['expense', 'Add expense'],
  ['income', 'Add income'],
  [undefined, 'Add expense'],
] as const)('native creation route accepts %s direction', async (direction, title) => {
  mockUseLocalSearchParams.mockReturnValue({ direction });
  const view = await render(<NativeNewTransactionRoute data={creationData()} />);

  await waitFor(() => expect(view.getByText(title)).toBeTruthy());
  expect(mockReadAccounts).toHaveBeenCalledTimes(1);
  expect(mockListCategories).toHaveBeenCalledTimes(1);
});

test('native creation route rejects invalid and repeated directions before reading choices', async () => {
  mockUseLocalSearchParams.mockReturnValue({ direction: ['expense', 'income'] });
  const data: TransactionCreateData = {
    listActiveAccounts: jest.fn(async () => []),
    listActiveCategoryGroups: jest.fn(async () => []),
    readCommitmentOverview: jest.fn(),
    createCompleteTransaction: jest.fn(),
    createReservePayment: jest.fn(),
  };

  const view = await render(<NativeNewTransactionRoute data={data} />);

  expect(view.getByText('Invalid transaction link')).toBeTruthy();
  expect(data.listActiveAccounts).not.toHaveBeenCalled();
  expect(data.listActiveCategoryGroups).not.toHaveBeenCalled();
});

test('native creation route loads and returns an eligible reserve payment to its period', async () => {
  mockUseLocalSearchParams.mockReturnValue({
    mode: 'reserve-payment',
    commitmentId,
    period: '2026-09',
  });
  mockReadCommitmentOverview.mockResolvedValue(eligibleCommitmentOverview());
  mockCreateReservePayment.mockResolvedValue(transaction);
  const data = creationData();
  const view = await render(<NativeNewTransactionRoute data={data} />);

  await waitFor(() => expect(view.getByText('Record payment')).toBeTruthy());
  expect(mockReadCommitmentOverview).toHaveBeenCalledWith('2026-09');
  expect(view.getByText('Rent')).toBeTruthy();
  expect(view.queryByRole('button', { name: 'income' })).toBeNull();

  await fireEvent.changeText(view.getByLabelText('Amount'), '725000');
  await fireEvent.press(view.getByRole('button', { name: 'Save transaction' }));

  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith(
      '/settings/commitments?period=2026-09'
    )
  );
  expect(mockCreateReservePayment).toHaveBeenCalledWith(
    expect.objectContaining({
      commitmentId,
      period: '2026-09',
      transaction: expect.objectContaining({
        direction: 'expense',
        categoryId: reserveLeafId,
        amount: 725_000,
      }),
    })
  );
  expect(mockCreateTransaction).not.toHaveBeenCalled();
});

test('native creation route refuses a stale reserve payment before showing the form', async () => {
  mockUseLocalSearchParams.mockReturnValue({
    mode: 'reserve-payment',
    commitmentId,
    period: '2026-09',
  });
  const paid = eligibleCommitmentOverview();
  const item = paid.items[0];
  if (item === undefined) throw new Error('Missing commitment fixture');
  paid.items[0] = {
    ...item,
    state: { status: 'paid', transactionId },
  };
  mockReadCommitmentOverview.mockResolvedValue(paid);
  const view = await render(<NativeNewTransactionRoute data={creationData()} />);

  await waitFor(() => expect(view.getByText('Payment unavailable')).toBeTruthy());
  expect(view.getByText(/already paid/i)).toBeTruthy();
  expect(view.queryByLabelText('Amount')).toBeNull();
  expect(mockCreateReservePayment).not.toHaveBeenCalled();
});

test('native creation route retries a choice loading failure', async () => {
  mockUseLocalSearchParams.mockReturnValue({ direction: 'income' });
  mockReadAccounts.mockRejectedValueOnce(new Error('Accounts unavailable'));
  const view = await render(<NativeNewTransactionRoute data={creationData()} />);

  await waitFor(() => expect(view.getByText('Accounts unavailable')).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(view.getByText('Add income')).toBeTruthy());
  expect(mockReadAccounts).toHaveBeenCalledTimes(2);
});

test('cold-start cancellation replaces with transactions and does not mutate', async () => {
  mockUseLocalSearchParams.mockReturnValue({ direction: 'income' });
  const data = creationData();
  useTransactionFilters.setState({
    selectedPeriod: '2026-02',
    categoryId: '33333333-3333-4333-8333-333333333333',
    accountId: '22222222-2222-4222-8222-222222222222',
    quality: 'want',
  });
  const view = await render(<NativeNewTransactionRoute data={data} />);
  await waitFor(() => expect(view.getByText('Add income')).toBeTruthy());

  await fireEvent.press(view.getByRole('button', { name: 'Cancel' }));

  expect(mockCanGoBack).toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith('/transactions');
  expect(mockCreateTransaction).not.toHaveBeenCalled();
  expect(useTransactionFilters.getState()).toMatchObject({
    selectedPeriod: '2026-02',
    categoryId: '33333333-3333-4333-8333-333333333333',
    accountId: '22222222-2222-4222-8222-222222222222',
    quality: 'want',
  });
});

test('cancellation with history goes back without replacing', async () => {
  mockUseLocalSearchParams.mockReturnValue({ direction: 'income' });
  mockCanGoBack.mockReturnValue(true);
  const view = await render(<NativeNewTransactionRoute data={creationData()} />);
  await waitFor(() => expect(view.getByText('Add income')).toBeTruthy());

  await fireEvent.press(view.getByRole('button', { name: 'Cancel' }));

  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
});

test('the removal guard and cancel lock stay active while saving', async () => {
  mockUseLocalSearchParams.mockReturnValue({ direction: 'income' });
  let resolveCreate: (value: Transaction) => void = () => undefined;
  const createPromise = new Promise<Transaction>((resolve) => {
    resolveCreate = resolve;
  });
  mockCreateTransaction.mockImplementation(() => createPromise);
  const view = await render(<NativeNewTransactionRoute data={creationData()} />);
  await waitFor(() => expect(view.getByText('Add income')).toBeTruthy());

  await fireEvent.changeText(view.getByLabelText('Amount'), '10000');
  await fireEvent.press(view.getByRole('button', { name: 'Save transaction' }));
  const pendingCall = mockUsePreventRemove.mock.calls[mockUsePreventRemove.mock.calls.length - 1];
  expect(pendingCall?.[0]).toBe(true);
  if (typeof pendingCall?.[1] !== 'function') throw new Error('Expected removal guard callback');
  pendingCall[1]({ data: { action: { type: 'GO_BACK' } } });
  expect(view.getByRole('button', { name: 'Cancel' }).props.accessibilityState.disabled).toBe(true);
  expect(mockBack).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();

  await act(async () => {
    resolveCreate(transaction);
    await createPromise;
  });
  await waitFor(() => {
    const latest = mockUsePreventRemove.mock.calls[mockUsePreventRemove.mock.calls.length - 1];
    expect(latest?.[0]).toBe(false);
  });
});

test('successful creation redirects after the removal guard is disabled', async () => {
  mockUseLocalSearchParams.mockReturnValue({ direction: 'income' });
  mockCreateTransaction.mockResolvedValue(transaction);
  const view = await render(<NativeNewTransactionRoute data={creationData()} />);
  await waitFor(() => expect(view.getByText('Add income')).toBeTruthy());

  await fireEvent.changeText(view.getByLabelText('Amount'), '10000');
  await fireEvent.press(view.getByRole('button', { name: 'Save transaction' }));

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/transactions'));
  const latest = mockUsePreventRemove.mock.calls[mockUsePreventRemove.mock.calls.length - 1];
  expect(latest?.[0]).toBe(false);
  expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
});

test('navigation failure keeps the saved state and retries navigation only', async () => {
  mockUseLocalSearchParams.mockReturnValue({ direction: 'income' });
  mockCreateTransaction.mockResolvedValue(transaction);
  mockReplace.mockImplementationOnce(() => {
    throw new Error('Navigation unavailable');
  });
  const view = await render(<NativeNewTransactionRoute data={creationData()} />);
  await waitFor(() => expect(view.getByText('Add income')).toBeTruthy());

  await fireEvent.changeText(view.getByLabelText('Amount'), '10000');
  await fireEvent.press(view.getByRole('button', { name: 'Save transaction' }));
  await waitFor(() => expect(view.getByText('Navigation unavailable')).toBeTruthy());
  expect(view.getByText('Transaction saved.')).toBeTruthy();
  expect(mockCreateTransaction).toHaveBeenCalledTimes(1);

  await fireEvent.press(view.getByRole('button', { name: 'Back to transactions' }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(2));
  expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
});

test('web creation route never enters the ledger boundary', async () => {
  mockUseLocalSearchParams.mockReturnValue({ direction: 'income' });

  const view = await render(<WebNewTransactionRoute />);

  expect(view.getByText('Add income')).toBeTruthy();
  expect(view.getByText(/browser preview does not open the ledger/)).toBeTruthy();
  expect(mockReadAccounts).not.toHaveBeenCalled();
  expect(mockListCategories).not.toHaveBeenCalled();
  expect(mockCreateTransaction).not.toHaveBeenCalled();
});
