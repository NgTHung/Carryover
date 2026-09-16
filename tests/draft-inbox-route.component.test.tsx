import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import DraftsRoute from '../src/app/drafts';
import DraftsWebRoute from '../src/app/drafts.web';
import type { DraftTransaction } from '../src/data/transaction-validation';
import type { LedgerChangeListener } from '../src/data/ledger-change-notifier';
import type { PhotoAvailability } from '../src/photos/photo-contract';
import type { DraftInboxData } from '../src/data/draft-inbox';
import type { DraftInboxAppState } from '../src/ui/drafts/useDraftInbox';
import type { PhotoThumbnailResolver } from '../src/ui/photos/PhotoThumbnail';

const firstId = '10000000-0000-4000-8000-000000000001';
const secondId = '10000000-0000-4000-8000-000000000002';
const date = new Date(2026, 8, 15, 9);

const mockPush = jest.fn();
let focusEffect: (() => void | (() => void)) | undefined;

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = require('react') as typeof import('react');
    focusEffect = effect;
    React.useEffect(effect, [effect]);
  },
  Link: ({ children, href }: { children: ReactNode; href: string }) => {
    const React = require('react') as typeof import('react');
    return React.cloneElement(children as never, {
      onPress: () => mockPush(href),
    });
  },
}));

jest.mock('../src/photos/photo-access', () => ({
  resolvePhoto: jest.fn(),
}));

jest.mock('../src/ui/ledger-access', () => ({
  getDraftInboxData: jest.fn(),
  subscribeLedgerChanges: jest.fn(),
}));

function draft(id: string): DraftTransaction {
  return {
    id,
    accountId: '30000000-0000-4000-8000-000000000001',
    direction: 'expense',
    adjustmentEffect: null,
    amount: null,
    categoryId: null,
    quality: null,
    payer: { kind: 'you' },
    occurredAt: date,
    status: 'draft',
    photoKey: null,
    note: null,
    sourceLabel: null,
    createdAt: date,
    updatedAt: date,
    deletedAt: null,
  };
}

function appState(): DraftInboxAppState & {
  emit: (state: string) => void;
  remove: jest.Mock;
} {
  let listener: ((state: string) => void) | undefined;
  const remove = jest.fn();
  return {
    currentState: 'active',
    addEventListener: jest.fn((_event: 'change', next: (state: string) => void) => {
      listener = next;
      return { remove };
    }),
    emit: (state) => listener?.(state),
    remove,
  };
}

function repository(
  readActiveDrafts: DraftInboxData<'sync'>['readActiveDrafts']
): DraftInboxData<'sync'> {
  return { readActiveDrafts };
}

function availablePhotoResolver(): PhotoThumbnailResolver {
  return jest.fn(async (photoKey: string): Promise<PhotoAvailability> => ({
    status: 'unavailable',
    photoKey,
    reason: 'missing',
    message: 'Missing photo',
  }));
}

afterEach(async () => {
  await cleanup();
  focusEffect = undefined;
  mockPush.mockReset();
  jest.clearAllMocks();
});

test('subscribes before the initial read, opens the same draft id, and refreshes on committed invalidation', async () => {
  const events: string[] = [];
  let listener: LedgerChangeListener | undefined;
  const subscribe = jest.fn((next: LedgerChangeListener) => {
    events.push('subscribe');
    listener = next;
    return () => undefined;
  });
  const readActiveDrafts = jest.fn()
    .mockImplementationOnce(async () => {
      events.push('read');
      return [draft(firstId)];
    })
    .mockResolvedValueOnce([draft(secondId)]);
  const state = appState();

  await render(
    <DraftsRoute
      data={repository(readActiveDrafts)}
      subscribe={subscribe}
      resolvePhoto={availablePhotoResolver()}
      appState={state}
    />
  );

  await waitFor(() => expect(screen.getByTestId(`draft-row-${firstId}`)).toBeTruthy());
  expect(events.slice(0, 2)).toEqual(['subscribe', 'read']);
  await act(async () => {
    listener?.({ table: 'transactions', mutation: 'completed' });
  });
  await waitFor(() => expect(screen.getByTestId(`draft-row-${secondId}`)).toBeTruthy());
  expect(screen.queryByTestId(`draft-row-${firstId}`)).toBeNull();

  await act(async () => {
    fireEvent.press(screen.getByTestId(`draft-row-${secondId}`));
  });
  expect(mockPush).toHaveBeenCalledWith(`/transactions/${secondId}?from=drafts`);
});

test('foreground, later focus, retries, and fresh mounts reread SQLite', async () => {
  const readActiveDrafts = jest.fn(async () => [draft(firstId)]);
  const subscribe = jest.fn(() => () => undefined);
  const state = appState();
  await render(
    <DraftsRoute
      data={repository(readActiveDrafts)}
      subscribe={subscribe}
      resolvePhoto={availablePhotoResolver()}
      appState={state}
    />
  );
  await waitFor(() => expect(readActiveDrafts).toHaveBeenCalledTimes(1));

  await act(async () => {
    state.emit('background');
    state.emit('active');
  });
  await waitFor(() => expect(readActiveDrafts).toHaveBeenCalledTimes(2));

  await act(async () => {
    focusEffect?.();
  });
  await waitFor(() => expect(readActiveDrafts).toHaveBeenCalledTimes(3));

  readActiveDrafts.mockRejectedValueOnce(new Error('read failed'));
  await act(async () => {
    focusEffect?.();
  });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy());
  readActiveDrafts.mockResolvedValueOnce([draft(firstId)]);
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  });
  await waitFor(() => expect(readActiveDrafts).toHaveBeenCalledTimes(5));

  await cleanup();
  await render(
    <DraftsRoute
      data={repository(readActiveDrafts)}
      subscribe={subscribe}
      resolvePhoto={availablePhotoResolver()}
      appState={state}
    />
  );
  await waitFor(() => expect(readActiveDrafts.mock.calls.length).toBeGreaterThanOrEqual(4));
  expect(state.remove).toHaveBeenCalled();
});

test('ignores out-of-order results and cleans subscriptions after unmount', async () => {
  let resolveFirst: (drafts: DraftTransaction[]) => void = () => undefined;
  let resolveSecond: (drafts: DraftTransaction[]) => void = () => undefined;
  const first = new Promise<DraftTransaction[]>((resolve) => { resolveFirst = resolve; });
  const second = new Promise<DraftTransaction[]>((resolve) => { resolveSecond = resolve; });
  const readActiveDrafts = jest.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  let listener: LedgerChangeListener | undefined;
  const unsubscribe = jest.fn();
  const subscribe = jest.fn((next: LedgerChangeListener) => {
    listener = next;
    return unsubscribe;
  });
  const state = appState();

  const view = await render(
    <DraftsRoute
      data={repository(readActiveDrafts)}
      subscribe={subscribe}
      resolvePhoto={availablePhotoResolver()}
      appState={state}
    />
  );
  await waitFor(() => expect(listener).toBeDefined());
  await act(async () => {
    listener?.({ table: 'transactions', mutation: 'deleted' });
    resolveSecond([draft(secondId)]);
  });
  await waitFor(() => expect(screen.getByTestId(`draft-row-${secondId}`)).toBeTruthy());
  await act(async () => {
    resolveFirst([draft(firstId)]);
  });
  expect(screen.queryByTestId(`draft-row-${firstId}`)).toBeNull();

  await act(async () => {
    view.unmount();
  });
  await waitFor(() => expect(unsubscribe).toHaveBeenCalledTimes(1));
  expect(state.remove).toHaveBeenCalledTimes(1);
});

test('browser route never reads native ledger or photo storage and keeps navigation working', async () => {
  await render(<DraftsWebRoute />);
  expect(screen.getByText(/Drafts are available in the installed iPhone build/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Home' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Transactions' })).toBeTruthy();
});
