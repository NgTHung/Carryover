import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router as mockRouter } from 'expo-router';
import TransferRouteScreen from '../src/app/transfers/[transferId]';
import TransferRouteWebScreen from '../src/app/transfers/[transferId].web';
import type { LedgerChangeListener } from '../src/data/ledger-change-notifier';
import type { TransferRead } from '../src/data/transfer-reads';
import type { TransferDetailData } from '../src/ui/transfers/transfer-data-contract';
import { TransferDetail } from '../src/ui/transfers/TransferDetail';

const transferId = '11111111-1111-4111-8111-111111111111';
const date = new Date(2026, 8, 15, 12);
let mockRouteParameter: string | string[] | undefined;
let routeListener: LedgerChangeListener | undefined;

const transfer: TransferRead = {
  transfer: { id: transferId, amount: 200_000, occurredAt: date, createdAt: date },
  fromAccount: { id: '22222222-2222-4222-8222-222222222222', name: 'Bank', kind: 'bank' },
  toAccount: { id: '33333333-3333-4333-8333-333333333333', name: 'Cash', kind: 'cash' },
};

type MockRouter = {
  replace: jest.Mock;
  back: jest.Mock;
  canGoBack: jest.Mock;
};

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  },
  useLocalSearchParams: () => ({ transferId: mockRouteParameter }),
  useFocusEffect: (effect: () => undefined | (() => void)) => {
    const { useEffect } = require('react') as typeof import('react');
    useEffect(effect, []);
  },
}));

jest.mock('../src/ui/ledger-access', () => ({
  getTransferDetailData: jest.fn(),
  subscribeLedgerChanges: jest.fn(),
}));

const mockedRouter = mockRouter as unknown as MockRouter;

function createData(
  readTransfer: TransferDetailData['readTransfer']
): TransferDetailData {
  return { readTransfer };
}

function subscribe(listener: LedgerChangeListener) {
  routeListener = listener;
  return () => undefined;
}

beforeEach(() => {
  mockRouteParameter = transferId;
  routeListener = undefined;
  mockedRouter.replace.mockReset();
  mockedRouter.back.mockReset();
  mockedRouter.canGoBack.mockReset();
  mockedRouter.canGoBack.mockReturnValue(false);
});

afterEach(cleanup);

test('renders both account labels, positive amount, local date, and no edit controls', async () => {
  const onBack = jest.fn();
  await render(<TransferDetail transfer={transfer} onBack={onBack} />);
  expect(screen.getByRole('header', { name: 'Transfer' })).toBeTruthy();
  expect(screen.getByText('₫200.000')).toBeTruthy();
  expect(screen.getByText('Bank')).toBeTruthy();
  expect(screen.getByText('Bank account')).toBeTruthy();
  expect(screen.getByText('Cash')).toBeTruthy();
  expect(screen.getByText('Cash account')).toBeTruthy();
  expect(screen.getByText('15 Sept 2026')).toBeTruthy();
  expect(screen.getByText('Moving money between your accounts does not count as spending or income.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Edit|Delete/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to transactions' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('loads, rereads renamed accounts, handles deletion, and returns to Transactions', async () => {
  const renamed: TransferRead = {
    ...transfer,
    fromAccount: { ...transfer.fromAccount, name: 'Main bank' },
  };
  const readTransfer = jest.fn()
    .mockResolvedValueOnce(transfer)
    .mockResolvedValueOnce(renamed)
    .mockResolvedValueOnce(undefined);
  await render(
    <TransferRouteScreen
      data={createData(readTransfer)}
      subscribe={subscribe}
    />
  );
  await waitFor(() => expect(screen.getByText('Bank')).toBeTruthy());
  await act(async () => {
    routeListener?.({ table: 'accounts', mutation: 'edited' });
  });
  await waitFor(() => expect(screen.getByText('Main bank')).toBeTruthy());
  await act(async () => {
    routeListener?.({ table: 'transfers', mutation: 'deleted' });
  });
  await waitFor(() => expect(screen.getByRole('header', { name: 'Transfer unavailable' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Back to transactions' }));
  expect(mockedRouter.replace).toHaveBeenCalledWith('/transactions');
});

test('invalid links cause no read', async () => {
  mockRouteParameter = 'not-a-uuid';
  const invalidRead = jest.fn();
  await render(<TransferRouteScreen data={createData(invalidRead)} subscribe={subscribe} />);
  expect(screen.getByRole('header', { name: 'Invalid transfer link' })).toBeTruthy();
  expect(invalidRead).not.toHaveBeenCalled();
});

test('ignores an in-flight read after the route becomes invalid', async () => {
  let resolveRead: (value: TransferRead) => void = () => undefined;
  const pendingRead = new Promise<TransferRead>((resolve) => {
    resolveRead = resolve;
  });
  const readTransfer = jest.fn(() => pendingRead);
  const route = await render(
    <TransferRouteScreen data={createData(readTransfer)} subscribe={subscribe} />
  );
  await waitFor(() => expect(readTransfer).toHaveBeenCalledTimes(1));

  mockRouteParameter = 'not-a-uuid';
  await act(async () => {
    await route.rerender(
      <TransferRouteScreen data={createData(readTransfer)} subscribe={subscribe} />
    );
  });
  await waitFor(() => expect(screen.getByRole('header', { name: 'Invalid transfer link' })).toBeTruthy());

  await act(async () => {
    resolveRead(transfer);
    await pendingRead;
  });
  expect(screen.getByRole('header', { name: 'Invalid transfer link' })).toBeTruthy();
});

test('read failures offer retry without changing the route contract', async () => {
  const readTransfer = jest.fn()
    .mockRejectedValueOnce(new Error('read unavailable'))
    .mockResolvedValueOnce(transfer);
  await render(<TransferRouteScreen data={createData(readTransfer)} subscribe={subscribe} />);
  await waitFor(() => expect(screen.getByRole('header', { name: 'Transfer could not load' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByText('₫200.000')).toBeTruthy());
  expect(readTransfer).toHaveBeenCalledTimes(2);
});

test('uses an explicit browser-unavailable detail state', async () => {
  await render(<TransferRouteWebScreen />);
  expect(screen.getByText(/browser preview does not open the ledger/)).toBeTruthy();
});
