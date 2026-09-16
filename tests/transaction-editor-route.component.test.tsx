import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { ActiveAccount } from '../src/data/accounts';
import type { CategoryGroupWithLeaves } from '../src/data/category-types';
import type { PhotoAvailability, PhotoKey } from '../src/photos/photo-contract';
import { parseTransaction, type Transaction } from '../src/data/transaction-validation';
import TransactionRouteScreen from '../src/app/transactions/[transactionId]';
import type { TransactionEditorData } from '../src/ui/transactions/transaction-editor-contract';
import type { LedgerChangeListener } from '../src/data/ledger-change-notifier';

const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '11111111-1111-4111-8111-111111111112';
const accountId = '22222222-2222-4222-8222-222222222222';
const groupId = '33333333-3333-4333-8333-333333333333';
const leafId = '44444444-4444-4444-8444-444444444444';
const photoKey = 'photos/v1/55555555-5555-4555-8555-555555555555.jpg' as PhotoKey;

const mockUseLocalSearchParams = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: (...args: unknown[]) => mockUseLocalSearchParams(...args),
}));

jest.mock('../src/ui/ledger-access', () => ({
  getTransactionEditorData: jest.fn(),
  subscribeLedgerChanges: jest.fn(() => () => undefined),
}));

function transaction(
  id: string,
  overrides: Record<string, unknown> = {}
): Transaction {
  return parseTransaction({
    id,
    accountId,
    direction: 'expense',
    adjustmentEffect: null,
    amount: null,
    categoryId: null,
    quality: null,
    payer: { kind: 'you' },
    occurredAt: new Date(2026, 8, 15, 10),
    status: 'draft',
    photoKey,
    note: null,
    sourceLabel: null,
    createdAt: new Date(2026, 8, 15, 10),
    updatedAt: new Date(2026, 8, 15, 10),
    deletedAt: null,
    ...overrides,
  });
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
    id: leafId,
    name: 'Groceries',
    sort: 0,
    kind: 'spend',
    isSuggestion: false,
    deletedAt: null,
    group: { level: 'group', id: groupId, name: 'Food', sort: 0, kind: 'spend' },
  }],
}];

const accounts: ActiveAccount[] = [{
  accountId,
  name: 'Bank',
  kind: 'bank',
  isDefault: true,
}];

function editorData(
  readTransaction: TransactionEditorData['readTransaction'] = jest.fn(async () => transaction(firstId)),
  listActiveCategoryGroups: TransactionEditorData['listActiveCategoryGroups'] = jest.fn(async () => groups),
  listActiveAccounts: TransactionEditorData['listActiveAccounts'] = jest.fn(async () => accounts)
): TransactionEditorData {
  return {
    readTransaction,
    listActiveCategoryGroups,
    listActiveAccounts,
    createCategory: jest.fn(),
    editTransaction: jest.fn(),
    completeDraft: jest.fn(async (input) => transaction(
      input.transactionId,
      { status: 'complete', amount: input.amount, categoryId: input.categoryId ?? leafId }
    )),
    softDeleteTransaction: jest.fn(),
  };
}

function availablePhoto(): PhotoAvailability {
  return { status: 'available', photoKey, uri: 'file:///retained/receipt.jpg' };
}

function unavailablePhoto(): PhotoAvailability {
  return {
    status: 'unavailable',
    photoKey,
    reason: 'missing',
    message: 'Retained photo file is missing',
  };
}

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

test('loads a draft with its photo and completes without changing optional fields', async () => {
  mockUseLocalSearchParams.mockReturnValue({ transactionId: firstId });
  const data = editorData();
  const resolvePhoto = jest.fn(async () => availablePhoto());
  let listener: LedgerChangeListener | undefined;
  const subscribe = (next: LedgerChangeListener) => {
    listener = next;
    return () => undefined;
  };
  const view = await render(
    <TransactionRouteScreen
      data={data}
      subscribe={subscribe}
      resolvePhoto={resolvePhoto}
    />
  );

  await waitFor(() => expect(view.getByText('Complete draft')).toBeTruthy());
  await waitFor(() => expect(view.getByLabelText('Photo')).toBeTruthy());
  expect(view.getByRole('button', { name: 'need' }).props.accessibilityState.selected).toBe(false);
  expect(view.getByLabelText('Amount').props.value).toBe('');
  expect(view.getByLabelText('Date').props.value).toBe('2026-09-15');
  expect(view.getByRole('button', { name: 'Bank' }).props.accessibilityState.selected).toBe(true);

  await fireEvent.changeText(view.getByLabelText('Amount'), '45001');
  await fireEvent.press(view.getByRole('button', { name: 'Groceries' }));
  await fireEvent.press(view.getByRole('button', { name: 'Complete' }));

  await waitFor(() => expect(data.completeDraft).toHaveBeenCalledWith({
    transactionId: firstId,
    amount: 45_001,
    categoryId: leafId,
    changes: {},
  }));
  expect(resolvePhoto).toHaveBeenCalledWith(photoKey);
  expect(listener).toBeDefined();
});

test('keeps completion available when the retained photo is missing', async () => {
  mockUseLocalSearchParams.mockReturnValue({ transactionId: firstId });
  const data = editorData();
  const resolvePhoto = jest.fn(async () => unavailablePhoto());
  const view = await render(
    <TransactionRouteScreen data={data} resolvePhoto={resolvePhoto} />
  );

  await waitFor(() => expect(view.getByLabelText('Photo unavailable')).toBeTruthy());
  await fireEvent.changeText(view.getByLabelText('Amount'), '45001');
  await fireEvent.press(view.getByRole('button', { name: 'Groceries' }));
  await fireEvent.press(view.getByRole('button', { name: 'Complete' }));

  await waitFor(() => expect(data.completeDraft).toHaveBeenCalledTimes(1));
});

test('reports an invalid route without reading the ledger', async () => {
  mockUseLocalSearchParams.mockReturnValue({ transactionId: 'not-a-uuid' });
  const invalidData = editorData();
  const invalidView = await render(<TransactionRouteScreen data={invalidData} />);
  expect(invalidView.getByText('Invalid transaction link')).toBeTruthy();
  expect(invalidData.readTransaction).not.toHaveBeenCalled();
});

test('reports a missing route without rendering the editor', async () => {
  mockUseLocalSearchParams.mockReturnValue({ transactionId: firstId });
  const missingData = editorData(jest.fn(async () => undefined));
  const missingView = await render(<TransactionRouteScreen data={missingData} />);
  await waitFor(() => expect(missingView.getByText('Transaction unavailable')).toBeTruthy());
  expect(missingData.listActiveCategoryGroups).not.toHaveBeenCalled();
});

test('keeps the editor and its input when category refresh fails, then retries the read', async () => {
  mockUseLocalSearchParams.mockReturnValue({ transactionId: firstId });
  const listActiveCategoryGroups = jest
    .fn<Promise<CategoryGroupWithLeaves[]>, []>()
    .mockResolvedValueOnce(groups)
    .mockRejectedValueOnce(new Error('categories unavailable'))
    .mockResolvedValueOnce(groups);
  const data = editorData(jest.fn(async () => transaction(firstId)), listActiveCategoryGroups);
  let listener: LedgerChangeListener | undefined;
  const subscribe = (next: LedgerChangeListener) => {
    listener = next;
    return () => undefined;
  };
  const view = await render(<TransactionRouteScreen data={data} subscribe={subscribe} />);
  await waitFor(() => expect(view.getByText('Complete draft')).toBeTruthy());
  await fireEvent.changeText(view.getByLabelText('Amount'), '45001');
  listener?.({ table: 'categories', mutation: 'edited' });

  await waitFor(() => expect(view.getByText(/categories unavailable/)).toBeTruthy());
  expect(view.getByText('Complete draft')).toBeTruthy();
  expect(view.getByLabelText('Amount').props.value).toBe('45001');

  await fireEvent.press(view.getByRole('button', { name: 'Retry category refresh' }));
  await waitFor(() => expect(view.queryByText(/categories unavailable/)).toBeNull());
  expect(listActiveCategoryGroups).toHaveBeenCalledTimes(3);
});

test('ignores an old route read when the route id changes', async () => {
  let routeId = firstId;
  mockUseLocalSearchParams.mockImplementation(() => ({ transactionId: routeId }));
  const pending = new Map<string, (value: Transaction | undefined) => void>();
  const readTransaction = jest.fn(
    (id: string) => new Promise<Transaction | undefined>((resolve) => {
      pending.set(id, resolve);
    })
  );
  const data = editorData(readTransaction);
  const view = await render(<TransactionRouteScreen data={data} />);
  await waitFor(() => expect(readTransaction).toHaveBeenCalledWith(firstId));

  routeId = secondId;
  await view.rerender(<TransactionRouteScreen data={data} />);
  await waitFor(() => expect(readTransaction).toHaveBeenCalledWith(secondId));

  await actResolve(pending.get(firstId), transaction(firstId));
  await actResolve(pending.get(secondId), transaction(secondId, { occurredAt: new Date(2026, 8, 14, 10) }));

  await waitFor(() => expect(view.getByText('Complete draft')).toBeTruthy());
  expect(view.getByLabelText('Date').props.value).toBe('2026-09-14');
  expect(view.getByLabelText('Amount').props.value).toBe('');
});

async function actResolve<T>(
  resolve: ((value: T) => void) | undefined,
  value: T
): Promise<void> {
  await act(async () => {
    resolve?.(value);
    await new Promise<void>((finish) => setImmediate(finish));
  });
}
