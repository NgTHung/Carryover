import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import NativeCommitmentRoute from '../src/app/settings/commitments';
import WebCommitmentRoute from '../src/app/settings/commitments.web';
import type { CommitmentOverview } from '../src/data/commitment-overview';
import type { LedgerChangeListener } from '../src/data/ledger-change-notifier';
import type { CommitmentManagerData } from '../src/ui/commitments/commitment-manager-contract';

const mockParams = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  },
  useLocalSearchParams: () => mockParams(),
}));

jest.mock('../src/ui/ledger-access', () => ({
  getCommitmentManagerData: jest.fn(),
  subscribeLedgerChanges: jest.fn(() => () => undefined),
}));

function overview(period: CommitmentOverview['period']): CommitmentOverview {
  return {
    period,
    unpaidTotal: { status: 'available', amount: 0 },
    items: [],
  };
}

function managerData(
  readCommitmentOverview = jest.fn(async (period: unknown) => overview(period as CommitmentOverview['period']))
): CommitmentManagerData {
  return {
    readCommitmentOverview,
    listActiveCategoryGroups: jest.fn(async () => []),
    createCommitment: jest.fn(),
    editCommitment: jest.fn(),
    softDeleteCommitment: jest.fn(),
  };
}

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

test('invalid and repeated period parameters stop before ledger reads', async () => {
  mockParams.mockReturnValue({ period: ['2026-08', '2026-09'] });
  const data = managerData();
  await render(<NativeCommitmentRoute data={data} subscribe={() => () => undefined} />);

  expect(screen.getByText('Invalid commitment link')).toBeTruthy();
  expect(data.readCommitmentOverview).not.toHaveBeenCalled();
  expect(data.listActiveCategoryGroups).not.toHaveBeenCalled();
});

test('loads the selected period, changes its URL, and reloads relevant notifications', async () => {
  mockParams.mockReturnValue({ period: '2026-09' });
  const data = managerData();
  let listener: LedgerChangeListener = () => undefined;
  const subscribe = jest.fn((next: LedgerChangeListener) => {
    listener = next;
    return () => undefined;
  });
  await render(<NativeCommitmentRoute data={data} subscribe={subscribe} />);

  await waitFor(() => expect(screen.getByText('No commitments yet.')).toBeTruthy());
  expect(data.readCommitmentOverview).toHaveBeenCalledWith('2026-09');
  await userEvent.setup().press(screen.getByRole('button', { name: 'Next period' }));
  expect(mockReplace).toHaveBeenCalledWith('/settings/commitments?period=2026-10');

  await act(async () => {
    listener({ table: 'transactions', mutation: 'created' });
  });
  await waitFor(() => expect(data.readCommitmentOverview).toHaveBeenCalledTimes(2));
  await act(async () => {
    listener({ table: 'accounts', mutation: 'edited' });
  });
  expect(data.readCommitmentOverview).toHaveBeenCalledTimes(2);
});

test('normalizes a missing period into the URL and retries load failures', async () => {
  mockParams.mockReturnValue({ period: undefined });
  const read = jest
    .fn<Promise<CommitmentOverview>, [unknown]>()
    .mockRejectedValueOnce(new Error('Overview failed'))
    .mockResolvedValue(overview('2026-09'));
  const data = managerData(read);
  await render(
    <NativeCommitmentRoute
      data={data}
      subscribe={() => () => undefined}
      now={() => new Date(2026, 8, 14)}
    />
  );

  expect(mockReplace).toHaveBeenCalledWith('/settings/commitments?period=2026-09');
  await waitFor(() => expect(screen.getByText('Overview failed')).toBeTruthy());
  await userEvent.setup().press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByText('No commitments yet.')).toBeTruthy());
  expect(read).toHaveBeenCalledTimes(2);
});

test('suppresses an older period response after parameters change', async () => {
  let resolveSeptember: (value: CommitmentOverview) => void = () => undefined;
  const september = new Promise<CommitmentOverview>((resolve) => {
    resolveSeptember = resolve;
  });
  const read = jest.fn((period: unknown) =>
    period === '2026-09' ? september : Promise.resolve(overview('2026-10'))
  );
  const data = managerData(read);
  mockParams.mockReturnValue({ period: '2026-09' });
  const view = await render(
    <NativeCommitmentRoute data={data} subscribe={() => () => undefined} />
  );

  mockParams.mockReturnValue({ period: '2026-10' });
  await view.rerender(
    <NativeCommitmentRoute data={data} subscribe={() => () => undefined} />
  );
  await waitFor(() => expect(screen.getByText('October 2026')).toBeTruthy());
  await act(async () => resolveSeptember(overview('2026-09')));
  expect(screen.getByText('October 2026')).toBeTruthy();
});

test('web route parses the period without opening a ledger facade', async () => {
  mockParams.mockReturnValue({ period: '2026-09' });
  await render(<WebCommitmentRoute />);
  expect(screen.getByText(/Commitment management for 2026-09/)).toBeTruthy();

  await cleanup();
  mockParams.mockReturnValue({ period: ['2026-09'] });
  await render(<WebCommitmentRoute />);
  expect(screen.getByText('Invalid commitment link')).toBeTruthy();
});
