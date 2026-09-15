import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import AccountsRoute from '../src/app/settings/accounts';
import type { AccountBalance } from '../src/data/accounts';
import type { LedgerChangeListener } from '../src/data/ledger-change-notifier';
import type { AccountEditorData } from '../src/ui/accounts/account-editor-contract';

jest.mock('../src/ui/ledger-access', () => ({
  getAccountEditorData: jest.fn(),
  subscribeLedgerChanges: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => undefined | (() => void)) => {
    const { useEffect } = require('react') as typeof import('react');
    useEffect(effect, []);
  },
}));

const bankId = '10000000-0000-4000-8000-000000000001';
const cashId = '10000000-0000-4000-8000-000000000002';
const balances: AccountBalance[] = [
  {
    accountId: bankId,
    name: 'Bank',
    kind: 'bank',
    isDefault: true,
    openingBalance: 1_000_000,
    balance: 800_000,
  },
  {
    accountId: cashId,
    name: 'Cash',
    kind: 'cash',
    isDefault: false,
    openingBalance: 200_000,
    balance: 150_000,
  },
];

const mockUsePreventRemove = jest.fn();

jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (...args: unknown[]) => mockUsePreventRemove(...args),
}));

function repository(
  readAccountBalances: AccountEditorData['readAccountBalances'],
  editAccountDetails: AccountEditorData['editAccountDetails'] = jest.fn(async () => undefined)
): AccountEditorData {
  return {
    readAccountBalances,
    editAccountDetails,
    reconcileAccount: jest.fn(async () => ({
      status: 'unchanged' as const,
      accountId: bankId,
      balance: 800_000,
    })),
  };
}

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

test('loads again after an account notification and ignores a stale read', async () => {
  let resolveFirst: (value: AccountBalance[]) => void = () => undefined;
  const firstRead = new Promise<AccountBalance[]>((resolve) => {
    resolveFirst = resolve;
  });
  const refreshed = balances.map((account) =>
    account.accountId === bankId ? { ...account, name: 'Main bank' } : account
  );
  const readAccountBalances = jest
    .fn()
    .mockImplementationOnce(() => firstRead)
    .mockResolvedValueOnce(refreshed);
  let listener: LedgerChangeListener | undefined;
  const subscribe = jest.fn((next: LedgerChangeListener) => {
    listener = next;
    return () => undefined;
  });

  await render(
    <AccountsRoute
      data={repository(readAccountBalances)}
      subscribe={subscribe}
    />
  );
  await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
  if (listener === undefined) throw new Error('Expected account listener');

  await act(async () => {
    listener?.({ table: 'accounts', mutation: 'edited' });
  });
  await waitFor(() => expect(screen.getByText('Main bank')).toBeTruthy());

  await act(async () => {
    resolveFirst(balances);
    await firstRead;
  });
  expect(screen.getByText('Main bank')).toBeTruthy();
  expect(readAccountBalances).toHaveBeenCalledTimes(2);
});

test('blocks stale account edits after a failed save refresh, then retries only the read', async () => {
  const readAccountBalances = jest
    .fn()
    .mockResolvedValueOnce(balances)
    .mockRejectedValueOnce(new Error('read unavailable'))
    .mockResolvedValueOnce(balances.map((account) =>
      account.accountId === bankId
        ? {
            ...account,
            name: 'Main bank',
            openingBalance: 1_200_000,
            balance: 1_000_000,
          }
        : account
    ));
  const editAccountDetails = jest.fn(async () => undefined);
  await render(
    <AccountsRoute
      data={repository(readAccountBalances, editAccountDetails)}
      subscribe={() => () => undefined}
    />
  );
  await waitFor(() => expect(screen.getByText('Bank')).toBeTruthy());

  await fireEvent.press(screen.getByRole('button', { name: 'Edit details for Bank' }));
  await fireEvent.changeText(screen.getByLabelText('Account name'), 'Main bank');
  await fireEvent.changeText(screen.getByLabelText('Opening balance'), '1200000');
  await fireEvent.press(screen.getByRole('button', { name: 'Save details for Bank' }));
  await waitFor(() => expect(editAccountDetails).toHaveBeenCalledTimes(1));
  expect(editAccountDetails).toHaveBeenCalledWith({
    accountId: bankId,
    name: 'Main bank',
    openingBalance: 1_200_000,
  });
  await waitFor(() => expect(screen.getAllByText(/read unavailable/).length).toBeGreaterThan(0));
  await fireEvent.press(screen.getByRole('button', { name: 'Edit details for Bank' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Reconcile Bank' }));
  expect(screen.queryByLabelText('Account name')).toBeNull();
  expect(screen.queryByLabelText('Actual balance')).toBeNull();
  expect(editAccountDetails).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.queryByText(/read unavailable/)).toBeNull());
  await fireEvent.press(screen.getByRole('button', { name: 'Edit details for Main bank' }));
  expect(screen.getByLabelText('Account name')).toBeTruthy();
  expect(readAccountBalances).toHaveBeenCalledTimes(3);
  expect(editAccountDetails).toHaveBeenCalledTimes(1);
});

test('shows a retryable error when a notification refresh supersedes initial loading', async () => {
  let resolveInitialRead: (value: AccountBalance[]) => void = () => undefined;
  const initialRead = new Promise<AccountBalance[]>((resolve) => {
    resolveInitialRead = resolve;
  });
  const readAccountBalances = jest
    .fn()
    .mockImplementationOnce(() => initialRead)
    .mockRejectedValueOnce(new Error('Refresh unavailable'))
    .mockResolvedValueOnce(balances);
  let listener: LedgerChangeListener | undefined;
  const subscribe = jest.fn((next: LedgerChangeListener) => {
    listener = next;
    return () => undefined;
  });

  await render(
    <AccountsRoute
      data={repository(readAccountBalances)}
      subscribe={subscribe}
    />
  );
  await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
  if (listener === undefined) throw new Error('Expected account listener');

  await act(async () => {
    listener?.({ table: 'accounts', mutation: 'edited' });
  });
  await waitFor(() => expect(screen.getByText('Refresh unavailable')).toBeTruthy());

  await act(async () => {
    resolveInitialRead(balances);
    await initialRead;
  });
  expect(screen.queryByText('Loading account balances…')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByText('Bank')).toBeTruthy());
  expect(readAccountBalances).toHaveBeenCalledTimes(3);
});

test('the route removal guard follows a deferred account save', async () => {
  let resolveWrite: () => void = () => undefined;
  const write = new Promise<void>((resolve) => {
    resolveWrite = resolve;
  });
  const editAccountDetails = jest.fn(() => write);
  await render(
    <AccountsRoute
      data={repository(jest.fn(async () => balances), editAccountDetails)}
      subscribe={() => () => undefined}
    />
  );
  await waitFor(() => expect(screen.getByText('Bank')).toBeTruthy());

  await fireEvent.press(screen.getByRole('button', { name: 'Edit details for Bank' }));
  await fireEvent.changeText(screen.getByLabelText('Account name'), 'Pending bank');
  await fireEvent.press(screen.getByRole('button', { name: 'Save details for Bank' }));
  await waitFor(() => expect(editAccountDetails).toHaveBeenCalledTimes(1));
  expect(mockUsePreventRemove).toHaveBeenLastCalledWith(true, expect.any(Function));
  expect(screen.getByLabelText('Account name').props.editable).toBe(false);

  await act(async () => {
    resolveWrite();
    await write;
  });
  await waitFor(() =>
    expect(mockUsePreventRemove).toHaveBeenLastCalledWith(false, expect.any(Function))
  );
});

test('reports an initial read error and retries the public read API', async () => {
  const readAccountBalances = jest
    .fn()
    .mockRejectedValueOnce(new Error('Ledger unavailable'))
    .mockResolvedValueOnce(balances);
  await render(
    <AccountsRoute
      data={repository(readAccountBalances)}
      subscribe={() => () => undefined}
    />
  );

  await waitFor(() => expect(screen.getByText('Ledger unavailable')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByText('Bank')).toBeTruthy());
  expect(readAccountBalances).toHaveBeenCalledTimes(2);
});
