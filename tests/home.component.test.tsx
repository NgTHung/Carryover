import { act, cleanup, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { BudgetSnapshot } from '../src/budget/snapshot';
import { snapshotStore } from '../src/budget/snapshot-store';
import NativeHomeRoute from '../src/app/index';
import WebHomeRoute from '../src/app/index.web';
import { HomeSnapshotView } from '../src/ui/home/HomeSnapshotView';

const mockRetryBudgetSnapshot = jest.fn();
const mockNavigate = jest.fn();
const mockRandomUUID = jest.fn();

jest.mock('expo-crypto', () => ({
  randomUUID: (...args: unknown[]) => mockRandomUUID(...args),
}));

jest.mock('expo-router', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => {
    const React = require('react') as typeof import('react');
    return React.cloneElement(children as never, {
      onPress: () => mockNavigate(href),
    });
  },
  router: {
    push: (href: string) => mockNavigate(href),
  },
}));

jest.mock('../src/ui/CrossFade', () => ({
  CrossFade: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('../src/ui/ledger-access', () => ({
  retryBudgetSnapshot: () => mockRetryBudgetSnapshot(),
}));

const snapshot: BudgetSnapshot = {
  balanceTotal: 4_250_000,
  reservedUnpaid: 3_000_000,
  discretionary: 1_250_000,
  horizonDate: '2026-09-30',
  daysToHorizon: 29,
  perDay: 43_000,
  runwayDays: 21,
  spentThisMonth: 780_000,
  regrettedThisMonth: 145_000,
  owedToYou: 0,
  unloggedDrafts: 0,
  updatedAt: '2026-09-11T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  snapshotStore.setState({ status: 'loading' }, true);
  mockNavigate.mockReset();
  jest.clearAllMocks();
});

test('keeps all figures out of the loading state', async () => {
  await render(
    <HomeSnapshotView
      state={{ status: 'loading' }}
      onRetry={mockRetryBudgetSnapshot}
    />
  );

  expect(screen.getByText('Preparing your per day…')).toBeTruthy();
  expect(screen.queryByTestId('home-ready')).toBeNull();
  expect(screen.queryByText(/₫/)).toBeNull();
});

test('shows publication errors and retries without a stale figure', async () => {
  await render(
    <HomeSnapshotView
      state={{ status: 'error', error: new Error('shared storage unavailable') }}
      onRetry={mockRetryBudgetSnapshot}
    />
  );

  expect(screen.getByRole('alert')).toHaveTextContent('shared storage unavailable');
  expect(screen.queryByTestId('home-ready')).toBeNull();
  expect(screen.queryByText(/₫/)).toBeNull();

  await userEvent.setup().press(screen.getByRole('button', { name: 'Try again' }));
  expect(mockRetryBudgetSnapshot).toHaveBeenCalledTimes(1);
});

test('renders ready snapshot fields with no unknown badge or estimate marker', async () => {
  await render(<HomeSnapshotView state={{ status: 'ready', snapshot }} />);

  expect(screen.getByTestId('home-hero')).toHaveTextContent('₫43.000');
  expect(screen.getByText('to spend today')).toBeTruthy();
  expect(screen.getByText('₫4.250.000')).toBeTruthy();
  expect(screen.getByText('₫1.250.000')).toBeTruthy();
  expect(screen.getByText('21 days runway')).toBeTruthy();
  expect(screen.getByText('2026-09-30')).toBeTruthy();
  expect(screen.queryByTestId('home-unknown')).toBeNull();
  expect(screen.queryByText(/receivable/)).toBeNull();
  expect(screen.queryByText('~₫43.000')).toBeNull();
});

test('ready Home shows the stored horizon action without deriving a replacement', async () => {
  await render(
    <HomeSnapshotView
      state={{ status: 'ready', snapshot: { ...snapshot, horizonDate: '2027-01-01' } }}
      onChangeHorizon={() => mockNavigate('/horizon?period=2026-09')}
    />
  );

  expect(screen.getByText('2027-01-01')).toBeTruthy();
  await userEvent.setup().press(screen.getByRole('button', { name: 'Change horizon' }));
  expect(mockNavigate).toHaveBeenCalledWith('/horizon?period=2026-09');
});

test('marks a ready figure as approximate and shows unknowns and receivables', async () => {
  await render(
    <HomeSnapshotView
      state={{
        status: 'ready',
        snapshot: { ...snapshot, owedToYou: 200_000, unloggedDrafts: 2 },
      }}
    />
  );

  expect(screen.getByTestId('home-hero')).toHaveTextContent('~₫43.000');
  expect(screen.getByTestId('home-unknown')).toHaveTextContent('2 unlogged drafts');
  expect(screen.getByText('₫200.000 receivable')).toBeTruthy();
});

test('renders unavailable nullable figures instead of substituting zero', async () => {
  await render(
    <HomeSnapshotView
      state={{
        status: 'ready',
        snapshot: { ...snapshot, perDay: null, runwayDays: null },
      }}
    />
  );

  expect(screen.getByTestId('home-hero')).toHaveTextContent('Per day unavailable');
  expect(screen.getByText('Runway unavailable')).toBeTruthy();
  expect(screen.queryByText('₫0')).toBeNull();
});

test('keeps the capture affordance present in the thumb-reach area', async () => {
  await render(<HomeSnapshotView state={{ status: 'ready', snapshot }} />);

  const capture = screen.getByRole('button', { name: 'Capture' });
  expect(capture.props.accessibilityState?.disabled).toBe(true);
  expect(capture.props.accessibilityHint).toBe('Capture is not available yet.');
});

test('keeps ledger and settings routes reachable from home', async () => {
  await render(<HomeSnapshotView state={{ status: 'ready', snapshot }} />);
  const user = userEvent.setup();

  await user.press(screen.getByRole('button', { name: 'Transactions' }));
  await user.press(screen.getByRole('button', { name: 'Summary' }));
  await user.press(screen.getByRole('button', { name: 'Accounts' }));
  await user.press(screen.getByRole('button', { name: 'Commitments' }));

  expect(mockNavigate).toHaveBeenNthCalledWith(1, '/transactions');
  expect(mockNavigate).toHaveBeenNthCalledWith(2, '/summary');
  expect(mockNavigate).toHaveBeenNthCalledWith(3, '/settings/accounts');
  expect(mockNavigate).toHaveBeenNthCalledWith(4, '/settings/commitments');
});

test('native route subscribes to the published snapshot store', async () => {
  snapshotStore.setState({ status: 'ready', snapshot }, true);
  await render(<NativeHomeRoute />);

  expect(screen.getByTestId('home-hero')).toHaveTextContent('₫43.000');

  await act(async () => {
    snapshotStore.setState({
      status: 'ready',
      snapshot: { ...snapshot, perDay: 40_000, updatedAt: '2026-09-11T00:01:00.000Z' },
    }, true);
  });

  await waitFor(() => expect(screen.getByTestId('home-hero')).toHaveTextContent('₫40.000'));
});

test('native Home chooses the local period when the horizon action is activated', async () => {
  snapshotStore.setState({ status: 'ready', snapshot }, true);
  await render(<NativeHomeRoute now={() => new Date(2026, 11, 31)} />);

  await userEvent.setup().press(screen.getByRole('button', { name: 'Change horizon' }));

  expect(mockNavigate).toHaveBeenCalledWith('/horizon?period=2026-12');
});

test('native Home creates a fresh capture route id for each press', async () => {
  snapshotStore.setState({ status: 'ready', snapshot }, true);
  mockRandomUUID
    .mockReturnValueOnce('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA')
    .mockReturnValueOnce('BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB');
  await render(<NativeHomeRoute />);
  const user = userEvent.setup();

  await user.press(screen.getByRole('button', { name: 'Capture' }));
  await user.press(screen.getByRole('button', { name: 'Capture' }));

  expect(mockNavigate).toHaveBeenNthCalledWith(
    1,
    '/capture/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  );
  expect(mockNavigate).toHaveBeenNthCalledWith(
    2,
    '/capture/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  );
});

test('browser route uses the presentation preview without opening the ledger', async () => {
  await render(<WebHomeRoute />);

  expect(screen.getByText('Browser preview. The ledger and iOS widget are not connected.')).toBeTruthy();
  expect(screen.getByTestId('home-hero')).toHaveTextContent('~₫43.000');
});
