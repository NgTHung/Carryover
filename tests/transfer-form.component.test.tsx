import { act, cleanup, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import type { ActiveAccount } from '../src/data/accounts';
import { TransferForm } from '../src/ui/transfers/TransferForm';
import type { TransferCreationData } from '../src/ui/transfers/transfer-data-contract';

const bankId = '11111111-1111-4111-8111-111111111111';
const cashId = '22222222-2222-4222-8222-222222222222';
const openedAt = new Date(2026, 8, 15, 12, 30);

const accounts: ActiveAccount[] = [
  { accountId: bankId, name: 'Bank', kind: 'bank', isDefault: true },
  { accountId: cashId, name: 'Cash', kind: 'cash', isDefault: false },
];

function createData(
  recordTransfer: TransferCreationData['recordTransfer'] = jest.fn(async () => undefined)
): TransferCreationData {
  return {
    listActiveAccounts: jest.fn(async () => accounts),
    recordTransfer,
  };
}

function renderForm(
  data: TransferCreationData = createData(),
  overrides: Partial<React.ComponentProps<typeof TransferForm>> = {}
) {
  return render(
    <TransferForm
      accounts={accounts}
      openedAt={openedAt}
      data={data}
      onCancel={jest.fn()}
      onCommitted={jest.fn()}
      onWritePending={jest.fn()}
      now={() => openedAt}
      {...overrides}
    />
  );
}

afterEach(cleanup);

test('shows both account kinds, defaults to bank to cash, and records either direction', async () => {
  const recordTransfer = jest.fn(async () => undefined);
  const data = createData(recordTransfer);
  const user = userEvent.setup();
  await renderForm(data);

  expect(screen.getByLabelText('Amount').props.value).toBe('');
  expect(screen.getByLabelText('Date').props.value).toBe('2026-09-15');
  expect(screen.getByRole('button', { name: 'From: Bank (bank)' }).props.accessibilityState).toMatchObject({ selected: true });
  expect(screen.getByRole('button', { name: 'To: Cash (cash)' }).props.accessibilityState).toMatchObject({ selected: true });
  expect(screen.getByText('Moving money between your accounts does not count as spending or income.')).toBeTruthy();

  await user.type(screen.getByLabelText('Amount'), '200000');
  await user.press(screen.getByRole('button', { name: 'From: Cash (cash)' }));
  await user.press(screen.getByRole('button', { name: 'Record transfer' }));

  await waitFor(() => expect(recordTransfer).toHaveBeenCalledWith({
    fromAccountId: cashId,
    toAccountId: bankId,
    amount: 200_000,
    occurredAt: openedAt,
  }));
  expect(screen.getByText('Transfer recorded.')).toBeTruthy();
});

test('rejects blank and future input without writing', async () => {
  const data = createData();
  const user = userEvent.setup();
  await renderForm(data);

  await user.press(screen.getByRole('button', { name: 'Record transfer' }));
  expect(screen.getByText('Enter a positive whole-dong amount.')).toBeTruthy();
  expect(data.recordTransfer).not.toHaveBeenCalled();

  await user.type(screen.getByLabelText('Amount'), '1000');
  await user.clear(screen.getByLabelText('Date'));
  await user.type(screen.getByLabelText('Date'), '2026-09-16');
  await user.press(screen.getByRole('button', { name: 'Record transfer' }));
  expect(screen.getByText('Manual transaction date cannot be in the future')).toBeTruthy();
  expect(data.recordTransfer).not.toHaveBeenCalled();
});

test('preserves exact draft text after a failed write and retries once', async () => {
  const recordTransfer = jest.fn()
    .mockRejectedValueOnce(new Error('Ledger unavailable'))
    .mockResolvedValue(undefined);
  const data = createData(recordTransfer);
  const user = userEvent.setup();
  const onCommitted = jest.fn();
  await renderForm(data, { onCommitted });

  await user.type(screen.getByLabelText('Amount'), '00125000');
  await user.clear(screen.getByLabelText('Date'));
  await user.type(screen.getByLabelText('Date'), '2026-09-14');
  await user.press(screen.getByRole('button', { name: 'Record transfer' }));
  await waitFor(() => expect(screen.getByText(/Ledger unavailable/)).toBeTruthy());
  expect(screen.getByLabelText('Amount').props.value).toBe('00125000');
  expect(screen.getByLabelText('Date').props.value).toBe('2026-09-14');

  await user.press(screen.getByRole('button', { name: 'Record transfer' }));
  await waitFor(() => expect(onCommitted).toHaveBeenCalledTimes(1));
  expect(recordTransfer).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Transfer recorded.')).toBeTruthy();
});

test('cancellation does not write and pending submission disables the form', async () => {
  let resolveTransfer: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    resolveTransfer = resolve;
  });
  const recordTransfer = jest.fn(() => pending);
  const onCancel = jest.fn();
  const data = createData(recordTransfer);
  const user = userEvent.setup();
  await renderForm(data, { onCancel });

  await user.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  await user.type(screen.getByLabelText('Amount'), '1000');
  await fireEvent.press(screen.getByRole('button', { name: 'Record transfer' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Record transfer' }));
  expect(recordTransfer).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Amount').props.editable).toBe(false);
  expect(screen.getByRole('button', { name: 'Cancel' }).props.accessibilityState.disabled).toBe(true);
  expect(onCancel).toHaveBeenCalledTimes(1);

  await act(async () => {
    resolveTransfer();
    await pending;
  });
});

test('refuses to initialize without an unambiguous fixed account pair', async () => {
  const onCancel = jest.fn();
  await renderForm(createData(), {
    accounts: [{ accountId: bankId, name: 'Bank', kind: 'bank', isDefault: true }],
    onCancel,
  });
  expect(screen.getByText(/Two active accounts/)).toBeTruthy();
  await userEvent.setup().press(screen.getByRole('button', { name: 'Back to accounts' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
});
