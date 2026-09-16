import { cleanup, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { parseTransaction, type DraftTransaction } from '../src/data/transaction-validation';
import type { PhotoAvailability, PhotoKey } from '../src/photos/photo-contract';
import { DraftInboxView } from '../src/ui/drafts/DraftInboxView';
import type { DraftInboxLoadState } from '../src/ui/drafts/draft-inbox-contract';

const firstId = '10000000-0000-4000-8000-000000000001';
const secondId = '10000000-0000-4000-8000-000000000002';
const thirdId = '10000000-0000-4000-8000-000000000003';
const firstPhoto = 'photos/v1/11111111-1111-4111-8111-111111111111.jpg' as PhotoKey;
const secondPhoto = 'photos/v1/22222222-2222-4222-8222-222222222222.jpg' as PhotoKey;
const date = new Date(2026, 8, 15, 9);

jest.mock('expo-router', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => {
    const React = require('react') as typeof import('react');
    return React.cloneElement(children as never, {
      onPress: () => undefined,
      accessibilityLabel: href === '/' ? 'Home' : 'Transactions',
    });
  },
}));

function draft(
  id: string,
  overrides: Partial<DraftTransaction> = {}
): DraftTransaction {
  const transaction = parseTransaction({
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
    ...overrides,
  });
  if (transaction.status !== 'draft') throw new Error('Expected draft fixture');
  return transaction;
}

function unavailable(photoKey: string): PhotoAvailability {
  return {
    status: 'unavailable',
    photoKey,
    reason: 'missing',
    message: 'Photo is missing',
  };
}

afterEach(() => {
  cleanup();
});

test('renders mixed known and unknown rows, keeps photo failures local, and opens the same id', async () => {
  const onOpenDraft = jest.fn();
  const resolvePhoto = jest.fn(async (photoKey: string): Promise<PhotoAvailability> => {
    if (photoKey === firstPhoto) {
      return { status: 'available', photoKey: firstPhoto, uri: 'file:///first.jpg' };
    }
    return unavailable(photoKey);
  });
  const known = draft(firstId, { amount: 45_001, photoKey: firstPhoto, note: 'Lunch with team' });
  const unknown = draft(secondId);
  const missing = draft(thirdId, { amount: 8_000, photoKey: secondPhoto });

  await render(
    <DraftInboxView
      state={{ status: 'ready', drafts: [known, unknown, missing] }}
      resolvePhoto={resolvePhoto}
      onOpenDraft={onOpenDraft}
      onRetry={() => undefined}
    />
  );

  expect(screen.getByText('₫45.001')).toBeTruthy();
  expect(screen.getByText('Unknown amount')).toBeTruthy();
  expect(screen.getByText('Lunch with team')).toBeTruthy();
  expect(screen.getAllByText('15 Sept 2026')).toHaveLength(3);
  expect(screen.getByLabelText('No photo')).toBeTruthy();

  await waitFor(() => expect(screen.getByTestId(`draft-photo-${thirdId}`)).toHaveTextContent('Photo unavailable'));
  expect(screen.getByLabelText(/Open draft, ₫45\.001, expense, 15 Sept 2026/)).toBeTruthy();
  await userEvent.setup().press(screen.getByRole('button', { name: /Open draft, Unknown amount/ }));
  expect(onOpenDraft).toHaveBeenCalledWith(secondId);
});

test('keeps a known-only inbox reachable without an unknown count', async () => {
  const onOpenDraft = jest.fn();
  await render(
    <DraftInboxView
      state={{ status: 'ready', drafts: [draft(firstId, { amount: 1 })] }}
      resolvePhoto={jest.fn(async () => unavailable(firstPhoto))}
      onOpenDraft={onOpenDraft}
      onRetry={() => undefined}
    />
  );

  expect(screen.getByText('₫1')).toBeTruthy();
  expect(screen.queryByText('Unknown amount')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /Open draft/ }));
  expect(onOpenDraft).toHaveBeenCalledWith(firstId);
});

const inboxStates: Array<[DraftInboxLoadState, string]> = [
  [{ status: 'loading' }, 'Loading drafts…'],
  [{ status: 'ready', drafts: [] }, 'No active drafts.'],
  [{ status: 'error', message: 'SQLite unavailable' }, 'SQLite unavailable'],
];

test.each(inboxStates)('renders %s without removing navigation', async (state, message) => {
  const onRetry = jest.fn();
  await render(
    <DraftInboxView
      state={state}
      resolvePhoto={jest.fn(async () => unavailable(firstPhoto))}
      onOpenDraft={() => undefined}
      onRetry={onRetry}
    />
  );

  expect(screen.getByRole('header', { name: 'Drafts' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Home' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Transactions' })).toBeTruthy();
  expect(screen.getByText(message)).toBeTruthy();
  if (state.status === 'error') {
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  }
});
