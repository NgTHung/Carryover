import { cleanup, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import type { AccountBalance, ReconcileResult } from '../src/data/accounts';
import AccountsWebRoute from '../src/app/settings/accounts.web';
import { AccountReconcileScreen } from '../src/ui/accounts/AccountReconcileScreen';
import type { AccountReconcileData } from '../src/ui/accounts/account-reconcile-contract';

const bankId = '10000000-0000-4000-8000-000000000001';
const cashId = '10000000-0000-4000-8000-000000000002';
const balances: AccountBalance[] = [
  { accountId: bankId, name: 'Bank', kind: 'bank', isDefault: true, openingBalance: 1_000_000, balance: 800_000 },
  { accountId: cashId, name: 'Cash', kind: 'cash', isDefault: false, openingBalance: 200_000, balance: 150_000 },
];

const adjustedResult: ReconcileResult = {
  status: 'adjusted',
  accountId: bankId,
  balance: 900_000,
  adjustmentId: '30000000-0000-4000-8000-000000000001',
  adjustmentAmount: 100_000,
  adjustmentEffect: 'increase',
};

function repository(reconcileAccount: AccountReconcileData['reconcileAccount'] = jest.fn(async () => adjustedResult)) {
  return {
    readAccountBalances: jest.fn(async () => balances),
    reconcileAccount,
  } satisfies AccountReconcileData;
}

afterEach(() => cleanup());

test('shows both account balances and the account-specific reconcile prompts', async () => {
  await render(<AccountReconcileScreen data={repository()} />);

  await waitFor(() => expect(screen.getByText('₫800.000')).toBeTruthy());
  expect(screen.getByText('₫150.000')).toBeTruthy();
  expect(screen.getByText("What's actually in your wallet?")).toBeTruthy();
  expect(screen.getByText("What's actually in your bank account?")).toBeTruthy();
});

test('rejects fractional input before calling reconcile and reports a calm adjustment result', async () => {
  const reconcileAccount: AccountReconcileData['reconcileAccount'] = jest.fn(async () => adjustedResult);
  const data = repository(reconcileAccount);
  const user = userEvent.setup();
  await render(<AccountReconcileScreen data={data} />);
  await waitFor(() => expect(screen.getByText('Bank')).toBeTruthy());

  await user.press(screen.getAllByRole('button', { name: 'Reconcile' })[0]);
  await user.type(screen.getByLabelText('Actual balance'), '12.5');
  await user.press(screen.getAllByRole('button', { name: 'Reconcile' })[0]);

  expect(reconcileAccount).not.toHaveBeenCalled();
  expect(screen.getByText('Enter a whole, nonnegative VND amount.')).toBeTruthy();

  await user.clear(screen.getByLabelText('Actual balance'));
  await user.type(screen.getByLabelText('Actual balance'), '900000');
  await user.press(screen.getAllByRole('button', { name: 'Reconcile' })[0]);
  await waitFor(() => expect(reconcileAccount).toHaveBeenCalledWith(expect.objectContaining({
    accountId: bankId,
    statedBalance: 900000,
    occurredAt: expect.any(Date),
  })));
  expect(await screen.findByText('Balance adjusted. The adjustment is visible in Transactions.')).toBeTruthy();
});

test('accepts zero, reports an unchanged balance, and rejects unsafe input locally', async () => {
  const unchanged: ReconcileResult = {
    status: 'unchanged',
    accountId: bankId,
    balance: 0,
  };
  const reconcileAccount: AccountReconcileData['reconcileAccount'] = jest.fn(
    async () => unchanged
  );
  const user = userEvent.setup();
  await render(
    <AccountReconcileScreen data={repository(reconcileAccount)} />
  );
  await waitFor(() => expect(screen.getByText('Bank')).toBeTruthy());

  await user.press(screen.getAllByRole('button', { name: 'Reconcile' })[0]);
  await user.type(screen.getByLabelText('Actual balance'), '0');
  await user.press(screen.getAllByRole('button', { name: 'Reconcile' })[0]);
  await waitFor(() => expect(reconcileAccount).toHaveBeenCalledTimes(1));
  expect(
    await screen.findByText('Balance already matched. Nothing changed.')
  ).toBeTruthy();

  await user.press(screen.getAllByRole('button', { name: 'Reconcile' })[0]);
  await user.type(
    screen.getByLabelText('Actual balance'),
    '9007199254740992'
  );
  await user.press(screen.getAllByRole('button', { name: 'Reconcile' })[0]);
  expect(reconcileAccount).toHaveBeenCalledTimes(1);
  expect(
    screen.getByText('Enter a whole, nonnegative VND amount.')
  ).toBeTruthy();
});

test('reports a load error and retries the account read', async () => {
  const readAccountBalances = jest
    .fn()
    .mockRejectedValueOnce(new Error('Ledger unavailable'))
    .mockResolvedValueOnce(balances);
  const user = userEvent.setup();
  await render(
    <AccountReconcileScreen
      data={{
        readAccountBalances,
        reconcileAccount: jest.fn(async () => adjustedResult),
      }}
    />
  );

  await waitFor(() => expect(screen.getByText('Ledger unavailable')).toBeTruthy());
  await user.press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByText('Bank')).toBeTruthy());
  expect(readAccountBalances).toHaveBeenCalledTimes(2);
});

test('keeps the web route outside the ledger boundary', async () => {
  await render(<AccountsWebRoute />);

  expect(
    screen.getByText(
      'Account balances are available in the installed iPhone build. The browser preview does not open the ledger.'
    )
  ).toBeTruthy();
});
