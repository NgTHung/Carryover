import { act, cleanup, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import type { ActiveAccount } from '../src/data/accounts';
import NewTransferRoute from '../src/app/transfers/new';
import NewTransferWebRoute from '../src/app/transfers/new.web';
import AccountsRoute from '../src/app/settings/accounts';
import type { AccountBalance } from '../src/data/accounts';
import type { AccountEditorData } from '../src/ui/accounts/account-editor-contract';
import type { LedgerChangeListener } from '../src/data/ledger-change-notifier';
import type { TransferCreationData } from '../src/ui/transfers/transfer-data-contract';
import { router as mockRouter } from 'expo-router';

const bankId = '11111111-1111-4111-8111-111111111111';
const cashId = '22222222-2222-4222-8222-222222222222';
const openedAt = new Date(2026, 8, 15, 12, 30);

const accounts: ActiveAccount[] = [
  { accountId: bankId, name: 'Bank', kind: 'bank', isDefault: true },
  { accountId: cashId, name: 'Cash', kind: 'cash', isDefault: false },
];

const balances: AccountBalance[] = [
  { ...accounts[0], openingBalance: 0, balance: 0 },
  { ...accounts[1], openingBalance: 0, balance: 0 },
];

let accountListener: LedgerChangeListener | undefined;
const mockUsePreventRemove = jest.fn();

type MockRouter = {
  dismissTo: jest.Mock;
  replace: jest.Mock;
  push: jest.Mock;
  back: jest.Mock;
  canGoBack: jest.Mock;
};

const mockedRouter = mockRouter as unknown as MockRouter;

jest.mock('expo-router', () => ({
  router: {
    dismissTo: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  },
  useFocusEffect: (effect: () => undefined | (() => void)) => {
    const { useEffect } = require('react') as typeof import('react');
    useEffect(effect, []);
  },
}));

jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (...args: unknown[]) => mockUsePreventRemove(...args),
}));

jest.mock('../src/ui/ledger-access', () => ({
  getTransferCreationData: jest.fn(),
  subscribeLedgerChanges: jest.fn(),
}));

function createData(
  listActiveAccounts: TransferCreationData['listActiveAccounts'] = jest.fn(async () => accounts),
  recordTransfer: TransferCreationData['recordTransfer'] = jest.fn(async () => undefined)
): TransferCreationData {
  return { listActiveAccounts, recordTransfer };
}

function renderRoute(
  data: TransferCreationData = createData(),
  subscribe: (listener: LedgerChangeListener) => () => void = (listener) => {
    accountListener = listener;
    return () => undefined;
  }
) {
  return render(<NewTransferRoute data={data} subscribe={subscribe} now={() => openedAt} />);
}

beforeEach(() => {
  accountListener = undefined;
  mockedRouter.dismissTo.mockReset();
  mockedRouter.replace.mockReset();
  mockedRouter.push.mockReset();
  mockedRouter.back.mockReset();
  mockedRouter.canGoBack.mockReturnValue(false);
  mockUsePreventRemove.mockReset();
});

afterEach(cleanup);

test('loads active accounts, preserves typed fields across refresh, and records once', async () => {
  const refreshed = accounts.map((account) =>
    account.accountId === bankId ? { ...account, name: 'Main bank' } : account
  );
  const listActiveAccounts = jest
    .fn()
    .mockResolvedValueOnce(accounts)
    .mockResolvedValueOnce(refreshed);
  const recordTransfer = jest.fn(async () => undefined);
  const user = userEvent.setup();
  await renderRoute(createData(listActiveAccounts, recordTransfer));
  await waitFor(() => expect(screen.getByRole('header', { name: 'Record transfer' })).toBeTruthy());

  await user.type(screen.getByLabelText('Amount'), '200000');
  await act(async () => {
    accountListener?.({ table: 'accounts', mutation: 'edited' });
  });
  await waitFor(() => expect(screen.getByRole('button', { name: 'From: Main bank (bank)' })).toBeTruthy());
  expect(screen.getByLabelText('Amount').props.value).toBe('200000');

  await user.press(screen.getByRole('button', { name: 'Record transfer' }));
  await waitFor(() => expect(recordTransfer).toHaveBeenCalledTimes(1));
  expect(recordTransfer).toHaveBeenCalledWith({
    fromAccountId: bankId,
    toAccountId: cashId,
    amount: 200_000,
    occurredAt: openedAt,
  });
  await waitFor(() => expect(mockedRouter.dismissTo).toHaveBeenCalledWith('/settings/accounts'));
  expect(mockedRouter.replace).not.toHaveBeenCalled();
});

test('blocks submission when refreshed accounts no longer contain the selected pair', async () => {
  const listActiveAccounts = jest
    .fn()
    .mockResolvedValueOnce(accounts)
    .mockResolvedValueOnce([accounts[0]])
    .mockResolvedValueOnce(accounts);
  const recordTransfer = jest.fn(async () => undefined);
  const user = userEvent.setup();
  await renderRoute(createData(listActiveAccounts, recordTransfer));
  await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());

  await user.type(screen.getByLabelText('Amount'), '1000');
  await act(async () => {
    accountListener?.({ table: 'accounts', mutation: 'deleted' });
  });

  await waitFor(() => expect(screen.getByText(/Two active accounts/)).toBeTruthy());
  expect(screen.queryByRole('button', { name: 'To: Cash (cash)' })).toBeNull();
  expect(screen.getByLabelText('Amount').props.value).toBe('1000');
  expect(screen.getByRole('button', { name: 'Record transfer' }).props.accessibilityState.disabled).toBe(true);
  expect(recordTransfer).not.toHaveBeenCalled();

  await user.press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Record transfer' }).props.accessibilityState.disabled).toBe(false)
  );
  expect(screen.getByLabelText('Amount').props.value).toBe('1000');
});

test('shows a retryable read error without allowing a duplicate save', async () => {
  const listActiveAccounts = jest
    .fn()
    .mockResolvedValueOnce(accounts)
    .mockRejectedValueOnce(new Error('refresh failed'))
    .mockResolvedValueOnce(accounts);
  const recordTransfer = jest.fn(async () => undefined);
  await renderRoute(createData(listActiveAccounts, recordTransfer));
  await waitFor(() => expect(screen.getByRole('header', { name: 'Record transfer' })).toBeTruthy());

  await fireEvent.changeText(screen.getByLabelText('Amount'), '1000');
  await fireEvent.press(screen.getByRole('button', { name: 'Record transfer' }));
  await waitFor(() => expect(screen.getByText('Transfer recorded.')).toBeTruthy());
  await act(async () => {
    accountListener?.({ table: 'accounts', mutation: 'edited' });
  });
  await waitFor(() => expect(screen.getByText(/refresh failed/)).toBeTruthy());
  expect(recordTransfer).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.queryByText(/refresh failed/)).toBeNull());
  expect(recordTransfer).toHaveBeenCalledTimes(1);
});

test('keeps removal guarded while the write is pending and cancel never writes', async () => {
  let resolveTransfer: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    resolveTransfer = resolve;
  });
  const recordTransfer = jest.fn(() => pending);
  const user = userEvent.setup();
  await renderRoute(createData(jest.fn(async () => accounts), recordTransfer));
  await waitFor(() => expect(screen.getByRole('header', { name: 'Record transfer' })).toBeTruthy());

  await user.type(screen.getByLabelText('Amount'), '1000');
  await fireEvent.press(screen.getByRole('button', { name: 'Record transfer' }));
  expect(recordTransfer).toHaveBeenCalledTimes(1);
  expect(mockUsePreventRemove).toHaveBeenLastCalledWith(true, expect.any(Function));
  expect(screen.getByRole('button', { name: 'Cancel' }).props.accessibilityState.disabled).toBe(true);
  expect(mockedRouter.replace).not.toHaveBeenCalled();

  await act(async () => {
    resolveTransfer();
    await pending;
  });
});

test('reports unavailable fixed accounts and offers return navigation', async () => {
  const onlyBank = [accounts[0]];
  await renderRoute(createData(jest.fn(async () => onlyBank)));
  await waitFor(() => expect(screen.getByText(/Two active accounts/)).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Back to accounts' }));
  await waitFor(() => expect(mockedRouter.replace).toHaveBeenCalledWith('/settings/accounts'));
});

test('adds the Accounts entry action and disables it during account interaction', async () => {
  const data: AccountEditorData = {
    readAccountBalances: jest.fn(async () => balances),
    editAccountDetails: jest.fn(async () => undefined),
    reconcileAccount: jest.fn(async () => ({
      status: 'unchanged' as const,
      accountId: bankId,
      balance: 0,
    })),
  };
  const user = userEvent.setup();
  await render(
    <AccountsRoute data={data} subscribe={() => () => undefined} />
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Record transfer' })).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Record transfer' }).props.accessibilityState.disabled).toBe(false);

  await user.press(screen.getByRole('button', { name: 'Edit details for Bank' }));
  expect(screen.getByRole('button', { name: 'Record transfer' }).props.accessibilityState.disabled).toBe(true);
  await user.press(screen.getByRole('button', { name: 'Cancel editing Bank' }));
  await user.press(screen.getByRole('button', { name: 'Record transfer' }));
  expect(mockedRouter.push).toHaveBeenCalledWith('/transfers/new');
});

test('keeps the browser creation route outside the ledger boundary', async () => {
  await render(<NewTransferWebRoute />);
  expect(screen.getByText(/browser preview does not open the ledger/)).toBeTruthy();
});

test('disables the Accounts action after a failed refresh and restores it on read retry', async () => {
  const readAccountBalances = jest
    .fn()
    .mockResolvedValueOnce(balances)
    .mockRejectedValueOnce(new Error('account refresh failed'))
    .mockResolvedValueOnce(balances);
  const data: AccountEditorData = {
    readAccountBalances,
    editAccountDetails: jest.fn(async () => undefined),
    reconcileAccount: jest.fn(async () => ({
      status: 'unchanged' as const,
      accountId: bankId,
      balance: 0,
    })),
  };
  const subscribe = (listener: LedgerChangeListener) => {
    accountListener = listener;
    return () => undefined;
  };
  await render(<AccountsRoute data={data} subscribe={subscribe} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Record transfer' })).toBeTruthy());
  await act(async () => {
    accountListener?.({ table: 'accounts', mutation: 'edited' });
  });
  await waitFor(() => expect(screen.getByText(/account refresh failed/)).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Record transfer' }).props.accessibilityState.disabled).toBe(true);
  await userEvent.setup().press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Record transfer' }).props.accessibilityState.disabled).toBe(false));
});
