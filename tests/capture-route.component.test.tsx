import {
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { View } from 'react-native';

import type { CaptureLedgerData } from '../src/ui/ledger-access';
import type {
  CaptureCamera,
  CapturePermission,
} from '../src/ui/capture/capture-contract';
import type { Transaction } from '../src/data/transaction-validation';
import CaptureRoute from '../src/app/capture/[draftId]';

const draftId = '123e4567-e89b-42d3-a456-426614174000';
const accountId = '123e4567-e89b-42d3-a456-426614174001';
const photoKey = 'photos/v1/123e4567-e89b-42d3-a456-426614174002.jpg';
const occurredAt = new Date(2026, 8, 15, 12, 30);

const mockParams = jest.fn<
  { draftId?: string | string[] },
  []
>();
const mockPermissionResponse = {
  granted: true,
  canAskAgain: true,
  status: 'granted',
};
const mockRequestPermission = jest.fn(async () => mockPermissionResponse);
const mockRefreshPermission = jest.fn(async () => mockPermissionResponse);

jest.mock('expo-camera', () => ({
  CameraView: () => {
    const React = require('react') as typeof import('react');
    const { View: NativeView } = require('react-native') as typeof import('react-native');
    return React.createElement(NativeView, { testID: 'native-camera' });
  },
  useCameraPermissions: () => [
    mockPermissionResponse,
    mockRequestPermission,
    mockRefreshPermission,
  ],
}));

jest.mock('expo-router', () => ({
  router: {
    canGoBack: jest.fn(() => false),
    back: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => mockParams(),
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = require('react') as typeof import('react');
    React.useEffect(effect, [effect]);
  },
}));

jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: jest.fn(),
}));

jest.mock('../src/photos/photo-access', () => ({
  preparePhoto: jest.fn(),
  retainPhoto: jest.fn(),
  discardPreparedPhoto: jest.fn(),
}));

jest.mock('../src/ui/ledger-access', () => ({
  getCaptureLedgerData: jest.fn(),
}));

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: draftId,
    accountId,
    direction: 'expense',
    adjustmentEffect: null,
    amount: 45_001,
    categoryId: null,
    quality: null,
    payer: { kind: 'you' },
    occurredAt,
    status: 'draft',
    photoKey,
    note: null,
    sourceLabel: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    deletedAt: null,
    ...overrides,
  } as Transaction;
}

function createHarness(
  readTransaction: CaptureLedgerData['readTransaction']
): { data: CaptureLedgerData; camera: CaptureCamera; permission: CapturePermission } {
  const data: CaptureLedgerData = {
    readTransaction,
    createCapturedDraft: jest.fn(),
  };
  const camera: CaptureCamera = {
    renderPreview: jest.fn(() => <View testID="injected-camera" />),
    takePicture: jest.fn(async () => ({ uri: 'camera://receipt.jpg' })),
  };
  const permission: CapturePermission = { status: 'granted' };
  return { data, camera, permission };
}

function routerMock(): {
  replace: jest.Mock;
} {
  return jest.requireMock('expo-router').router as { replace: jest.Mock };
}

test('rejects an invalid or repeated route parameter before ledger or camera work', async () => {
  mockParams.mockReturnValue({ draftId: ['not-a-uuid', 'second-value'] });
  const readTransaction = jest.fn(async () => undefined);
  const harness = createHarness(readTransaction);

  await render(
    <CaptureRoute
      data={harness.data}
      camera={harness.camera}
      permission={harness.permission}
    />
  );

  expect(screen.getByText('Invalid capture link')).toBeTruthy();
  expect(readTransaction).not.toHaveBeenCalled();
  expect(harness.camera.renderPreview).not.toHaveBeenCalled();
});

test('reads a new id before opening one camera preview', async () => {
  mockParams.mockReturnValue({ draftId });
  const readTransaction = jest.fn(async () => undefined);
  const harness = createHarness(readTransaction);

  await render(
    <CaptureRoute
      data={harness.data}
      camera={harness.camera}
      permission={harness.permission}
    />
  );

  await waitFor(() => expect(readTransaction).toHaveBeenCalledWith(draftId));
  await waitFor(() => expect(harness.camera.renderPreview).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Take photo' })).toBeTruthy();
});

test('does not reopen the camera for an already saved capture id', async () => {
  mockParams.mockReturnValue({ draftId });
  const readTransaction = jest.fn(async () => transaction());
  const harness = createHarness(readTransaction);

  await render(
    <CaptureRoute
      data={harness.data}
      camera={harness.camera}
      permission={harness.permission}
    />
  );

  await waitFor(() => expect(screen.getByText('Capture already saved')).toBeTruthy());
  expect(harness.camera.renderPreview).not.toHaveBeenCalled();
  expect(routerMock().replace).toHaveBeenCalledWith('/');
});

test('shows an identity collision without overwriting the existing row', async () => {
  mockParams.mockReturnValue({ draftId });
  const readTransaction = jest.fn(async () =>
    transaction({ status: 'complete', amount: 45_001, categoryId: accountId })
  );
  const harness = createHarness(readTransaction);

  await render(
    <CaptureRoute
      data={harness.data}
      camera={harness.camera}
      permission={harness.permission}
    />
  );

  await waitFor(() => expect(screen.getByText('Capture link unavailable')).toBeTruthy());
  expect(harness.camera.renderPreview).not.toHaveBeenCalled();
  expect(harness.data.createCapturedDraft).not.toHaveBeenCalled();
});
