import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import type { AccountBalance } from '../src/data/accounts';
import { AccountReconcileScreen } from '../src/ui/accounts/AccountReconcileScreen';
import type { AccountEditorData } from '../src/ui/accounts/account-editor-contract';

const bankId = '10000000-0000-4000-8000-000000000001';
const cashId = '10000000-0000-4000-8000-000000000002';
const accounts: AccountBalance[] = [
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

function repository(
  overrides: Partial<AccountEditorData> = {}
): AccountEditorData {
  return {
    readAccountBalances: jest.fn(async () => accounts),
    editAccountDetails: jest.fn(async () => undefined),
    reconcileAccount: jest.fn(async () => ({
      status: 'unchanged' as const,
      accountId: bankId,
      balance: 800_000,
    })),
    ...overrides,
  };
}

afterEach(() => cleanup());

test('edits name and opening balance while keeping the fixed identity visible', async () => {
  const editAccountDetails = jest.fn(async () => undefined);
  const onReload = jest.fn(async () => undefined);
  const data = repository({ editAccountDetails });
  await render(
    <AccountReconcileScreen
      accounts={accounts}
      data={data}
      onReload={onReload}
    />
  );

  expect(screen.getByText('Bank account')).toBeTruthy();
  expect(screen.getByText('Default')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Edit details for Bank' }));
  expect(screen.getByLabelText('Account name').props.value).toBe('Bank');
  expect(screen.getByLabelText('Opening balance').props.value).toBe('1000000');
  expect(screen.getByText(/Your opening balance is what you held/)).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Account name'), '  Main bank  ');
  await fireEvent.changeText(screen.getByLabelText('Opening balance'), '1200000');
  await fireEvent.press(screen.getByRole('button', { name: 'Save details for Bank' }));

  await waitFor(() =>
    expect(editAccountDetails).toHaveBeenCalledWith({
      accountId: bankId,
      name: 'Main bank',
      openingBalance: 1_200_000,
    })
  );
  expect(editAccountDetails).toHaveBeenCalledTimes(1);
  expect(onReload).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('Account details saved.')).toBeTruthy();
});

test('zero succeeds, while blank names and invalid money stay local', async () => {
  const editAccountDetails = jest.fn(async () => undefined);
  const data = repository({ editAccountDetails });
  await render(<AccountReconcileScreen accounts={accounts} data={data} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Edit details for Cash' }));
  await fireEvent.changeText(screen.getByLabelText('Account name'), '   ');
  await fireEvent.changeText(screen.getByLabelText('Opening balance'), '12.5');
  await fireEvent.press(screen.getByRole('button', { name: 'Save details for Cash' }));
  expect(editAccountDetails).not.toHaveBeenCalled();
  expect(screen.getByText('Enter a non-blank account name.')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Account name'), 'Cash');
  await fireEvent.press(screen.getByRole('button', { name: 'Save details for Cash' }));
  expect(editAccountDetails).not.toHaveBeenCalled();
  expect(screen.getByText('Enter a whole, nonnegative VND amount.')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Opening balance'), '0');
  await fireEvent.press(screen.getByRole('button', { name: 'Save details for Cash' }));
  await waitFor(() => expect(editAccountDetails).toHaveBeenCalledTimes(1));
  expect(editAccountDetails).toHaveBeenCalledWith({
    accountId: cashId,
    name: 'Cash',
    openingBalance: 0,
  });
});

test('cancel and a background refresh do not replace a dirty details draft', async () => {
  const editAccountDetails = jest.fn(async () => undefined);
  const data = repository({ editAccountDetails });
  const view = await render(<AccountReconcileScreen accounts={accounts} data={data} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Edit details for Bank' }));
  await fireEvent.changeText(screen.getByLabelText('Account name'), 'Dirty bank');
  await view.rerender(
    <AccountReconcileScreen
      accounts={accounts.map((account) =>
        account.accountId === bankId
          ? { ...account, name: 'Refreshed bank', balance: 900_000 }
          : account
      )}
      data={data}
    />
  );
  expect(screen.getByLabelText('Account name').props.value).toBe('Dirty bank');
  expect(screen.getByText('₫900.000')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Cancel editing Refreshed bank' }));
  expect(editAccountDetails).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Edit details for Cash' }));
  expect(screen.getByLabelText('Account name').props.value).toBe('Cash');
});

test('a deferred save blocks duplicate submits and dismissal', async () => {
  let resolveWrite: () => void = () => undefined;
  const write = new Promise<void>((resolve) => {
    resolveWrite = resolve;
  });
  const editAccountDetails = jest.fn(() => write);
  const onWritePending = jest.fn();
  await render(
    <AccountReconcileScreen
      accounts={accounts}
      data={repository({ editAccountDetails })}
      onWritePending={onWritePending}
    />
  );

  await fireEvent.press(screen.getByRole('button', { name: 'Edit details for Bank' }));
  await fireEvent.changeText(screen.getByLabelText('Account name'), 'Bank pending');
  await fireEvent.press(screen.getByRole('button', { name: 'Save details for Bank' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save details for Bank' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel editing Bank' }));

  expect(editAccountDetails).toHaveBeenCalledTimes(1);
  expect(onWritePending).toHaveBeenLastCalledWith(true);
  expect(screen.getByLabelText('Account name').props.editable).toBe(false);

  await act(async () => {
    resolveWrite();
    await write;
  });
  await waitFor(() => expect(onWritePending).toHaveBeenLastCalledWith(false));
});

test('a rejected save keeps both exact fields and exposes a write error', async () => {
  const editAccountDetails = jest
    .fn()
    .mockRejectedValueOnce(new Error('database is locked'));
  await render(
    <AccountReconcileScreen
      accounts={accounts}
      data={repository({ editAccountDetails })}
    />
  );

  await fireEvent.press(screen.getByRole('button', { name: 'Edit details for Bank' }));
  await fireEvent.changeText(screen.getByLabelText('Account name'), 'Exact input');
  await fireEvent.changeText(screen.getByLabelText('Opening balance'), '001250');
  await fireEvent.press(screen.getByRole('button', { name: 'Save details for Bank' }));

  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/database is locked/));
  expect(screen.getByLabelText('Account name').props.value).toBe('Exact input');
  expect(screen.getByLabelText('Opening balance').props.value).toBe('001250');
  expect(editAccountDetails).toHaveBeenCalledTimes(1);
});
