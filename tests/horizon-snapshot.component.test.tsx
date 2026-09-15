import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { createSnapshotPublisher } from '../src/budget/snapshot-publisher';
import { snapshotStore } from '../src/budget/snapshot-store';
import type { BudgetInput } from '../src/budget/compute-budget';
import NativeHomeRoute from '../src/app/index';

const mockNavigate = jest.fn();
const mockRetryBudgetSnapshot = jest.fn();

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  router: { push: (href: string) => mockNavigate(href) },
}));

jest.mock('../src/ui/CrossFade', () => ({
  CrossFade: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('../src/ui/ledger-access', () => ({
  retryBudgetSnapshot: () => mockRetryBudgetSnapshot(),
}));

function input(horizonDate: BudgetInput['monthConfig']['horizonDate']): Omit<BudgetInput, 'updatedAt'> {
  return {
    today: '2026-09-15',
    monthConfig: { period: '2026-09', horizonDate },
    accountBalances: [150_000],
    reservedUnpaid: 0,
    transactions: [],
    shares: [],
    owedToYou: 0,
  };
}

afterEach(() => {
  cleanup();
  snapshotStore.setState({ status: 'loading' }, true);
  mockNavigate.mockReset();
  mockRetryBudgetSnapshot.mockReset();
});

test('Home renders the exact artifact from the real publisher through loading, failure, and retry', async () => {
  let horizonDate: BudgetInput['monthConfig']['horizonDate'] = '2026-09-30';
  let failWrite = false;
  const publisher = createSnapshotPublisher({
    store: snapshotStore,
    now: () => new Date('2026-09-15T12:00:00.000Z'),
    readInput: () => input(horizonDate),
    writer: () => {
      if (failWrite) throw new Error('shared storage unavailable');
    },
  });
  mockRetryBudgetSnapshot.mockImplementation(() => publisher.retry());
  const view = await render(<NativeHomeRoute now={() => new Date(2026, 8, 15)} />);
  const user = userEvent.setup();

  expect(screen.getByText('Preparing your per day…')).toBeTruthy();
  await act(async () => {
    await publisher.refresh();
  });
  await waitFor(() => expect(view.getByTestId('home-hero')).toHaveTextContent('₫10.000'));
  expect(view.getByText('2026-09-30')).toBeTruthy();

  horizonDate = '2026-10-15';
  failWrite = true;
  await act(async () => {
    await expect(publisher.refresh()).rejects.toThrow('shared storage unavailable');
  });
  await waitFor(() => expect(view.getByText('Per day unavailable')).toBeTruthy());
  expect(view.getByRole('alert')).toHaveTextContent('shared storage unavailable');

  failWrite = false;
  await user.press(view.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(view.getByTestId('home-hero')).toHaveTextContent('₫5.000'));
  expect(view.getByText('2026-10-15')).toBeTruthy();
});
