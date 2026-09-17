import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import { ExpoRoot } from 'expo-router';
import { getMockContext } from 'expo-router/testing-library';

import type { ActiveAccount } from '../src/data/accounts';
import type {
  CategoryGroupWithLeaves,
} from '../src/data/category-types';
import type { Transaction } from '../src/data/transaction-validation';
import type {
  DraftNudgeResponse,
  DraftNudgeServiceState,
} from '../src/notifications/draft-nudge-contract';
import {
  DRAFT_NUDGE_DEFAULT_ACTION_IDENTIFIER,
  DRAFT_NUDGE_IDENTIFIER,
  DRAFT_NUDGE_PAYLOAD,
} from '../src/notifications/draft-nudge-policy';
import type {
  DraftNudgeService,
  DraftNudgeServiceBindings,
} from '../src/notifications/draft-nudge-service';

const transactionId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const groupId = '33333333-3333-4333-8333-333333333333';
const leafId = '44444444-4444-4444-8444-444444444444';

const mockUseMigrations = jest.fn();
const mockReadTransaction = jest.fn();
const mockReadActiveDrafts = jest.fn();
const mockReadAccounts = jest.fn();
const mockReadAccountBalances = jest.fn();
const mockListCategories = jest.fn();
const mockReadMonthSummary = jest.fn();
const mockReadCommitmentOverview = jest.fn();
const mockCompleteDraft = jest.fn();
const mockLedgerSubscribe = jest.fn(() => () => undefined);
let mockResponseListener: ((response: DraftNudgeResponse) => void) | undefined;
let mockRetainedResponse: DraftNudgeResponse | null = null;

const mockServiceState: DraftNudgeServiceState = {
  status: 'idle',
  eligibility: { status: 'none' },
  reason: 'no-unknowns',
};
const mockService: DraftNudgeService = {
  getState: () => mockServiceState,
  subscribe: () => () => undefined,
  start: (_bindings: DraftNudgeServiceBindings) => () => undefined,
  reconcile: jest.fn(async () => undefined),
  retry: jest.fn(async () => undefined),
  requestPermission: jest.fn(async () => undefined),
  subscribeToResponses: jest.fn((listener: (response: DraftNudgeResponse) => void) => {
    mockResponseListener = listener;
    return () => {
      if (mockResponseListener === listener) mockResponseListener = undefined;
    };
  }),
  readLastResponse: jest.fn(() => mockRetainedResponse),
  clearLastResponse: jest.fn(() => {
    mockRetainedResponse = null;
  }),
  dispose: jest.fn(),
};

jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: (...args: unknown[]) => mockUseMigrations(...args),
}));

jest.mock('../src/data/database', () => ({
  ledgerDb: {},
  ledgerMigrations: {},
  ledgerChangeNotifier: { subscribe: mockLedgerSubscribe },
  readCommittedBudgetInput: jest.fn(async () => {
    throw new Error('Snapshot input is unavailable in reminder router tests.');
  }),
  readCommittedMonthSummary: (...args: unknown[]) => mockReadMonthSummary(...args),
  transactionData: {
    readTransaction: (...args: unknown[]) => mockReadTransaction(...args),
    editTransaction: jest.fn(),
    completeDraft: mockCompleteDraft,
    softDeleteTransaction: jest.fn(),
  },
  draftInboxData: {
    readActiveDrafts: (...args: unknown[]) => mockReadActiveDrafts(...args),
    hasUnknownDrafts: jest.fn(async () => false),
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
    completeDraft: mockCompleteDraft,
    softDeleteTransaction: jest.fn(),
  },
}));

jest.mock('../src/notifications/draft-nudge-access', () => ({
  getDraftNudgeService: () => mockService,
  startDraftNudgeService: () => () => undefined,
}));

jest.mock('../src/ui/QualityChip', () => ({
  QualityChip: ({ quality }: { quality: string }) => {
    const { Text } = require('react-native');
    return <Text>{quality}</Text>;
  },
}));

function notificationResponse(deliveredAt: number): DraftNudgeResponse {
  return {
    requestIdentifier: DRAFT_NUDGE_IDENTIFIER,
    deliveredAt,
    actionIdentifier: DRAFT_NUDGE_DEFAULT_ACTION_IDENTIFIER,
    data: DRAFT_NUDGE_PAYLOAD,
  };
}

const transaction: Transaction = {
  id: transactionId,
  accountId,
  direction: 'expense',
  adjustmentEffect: null,
  amount: null,
  categoryId: null,
  quality: null,
  payer: { kind: 'you' },
  occurredAt: new Date(2026, 8, 15, 10),
  status: 'draft',
  photoKey: null,
  note: null,
  sourceLabel: null,
  createdAt: new Date(2026, 8, 15, 10),
  updatedAt: new Date(2026, 8, 15, 10),
  deletedAt: null,
};

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

beforeEach(() => {
  mockUseMigrations.mockReturnValue({ success: true, error: undefined });
  mockReadTransaction.mockResolvedValue(transaction);
  mockReadActiveDrafts.mockResolvedValue([]);
  mockReadAccounts.mockResolvedValue(accounts);
  mockReadAccountBalances.mockResolvedValue([]);
  mockListCategories.mockResolvedValue(groups);
  mockReadMonthSummary.mockResolvedValue(undefined);
  mockReadCommitmentOverview.mockResolvedValue({
    period: '2026-09',
    unpaidTotal: { status: 'available', amount: 0 },
    items: [],
  });
  mockCompleteDraft.mockResolvedValue({ ...transaction, status: 'complete', amount: 45_001 });
  mockResponseListener = undefined;
  mockRetainedResponse = null;
});

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

test('uses the real router to open an empty Drafts inbox from a warm reminder tap', async () => {
  const view = await render(
    <ExpoRoot context={getMockContext('./src/app')} location="/" />
  );
  await waitFor(() => expect(view.getByText('Per day unavailable')).toBeTruthy());
  await waitFor(() => expect(mockResponseListener).toBeDefined());

  await act(async () => {
    mockResponseListener?.(notificationResponse(1_700_100_000_001));
  });

  await waitFor(() => expect(view.getByRole('header', { name: 'Drafts' })).toBeTruthy());
  expect(view.getByText('No active drafts.')).toBeTruthy();
});

test('keeps a pending editor completion while the real router opens Drafts', async () => {
  let resolveCompletion: (value: Transaction) => void = () => undefined;
  const completion = new Promise<Transaction>((resolve) => {
    resolveCompletion = resolve;
  });
  mockCompleteDraft.mockReturnValue(completion);

  const view = await render(
    <ExpoRoot
      context={getMockContext('./src/app')}
      location={`/transactions/${transactionId}?from=drafts`}
    />
  );
  await waitFor(() => expect(view.getByText('Complete draft')).toBeTruthy());
  await waitFor(() => expect(mockResponseListener).toBeDefined());

  await fireEvent.changeText(view.getByLabelText('Amount'), '45001');
  await fireEvent.press(view.getByRole('button', { name: 'Groceries' }));
  await fireEvent.press(view.getByRole('button', { name: 'Complete' }));
  await waitFor(() => expect(mockCompleteDraft).toHaveBeenCalledTimes(1));

  await act(async () => {
    mockResponseListener?.(notificationResponse(1_700_100_000_002));
  });
  await waitFor(() => expect(view.getByRole('header', { name: 'Drafts' })).toBeTruthy());

  await act(async () => {
    resolveCompletion({ ...transaction, status: 'complete', amount: 45_001, categoryId: leafId });
    await completion;
  });
  await waitFor(() => expect(view.getByText('No active drafts.')).toBeTruthy());
  expect(view.getByRole('header', { name: 'Drafts' })).toBeTruthy();
  expect(mockCompleteDraft).toHaveBeenCalledTimes(1);
});
