import { cleanup, render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

const mockSigningFacts = {
  bundleIdentifier: 'com.example.carryover',
  configuredAppGroup: 'group.com.example.carryover',
  resolvedAppGroup: 'group.com.example.carryover',
  grantedAppGroups: ['group.com.example.carryover'],
  grantedAppGroupsResolving: ['group.com.example.carryover'],
  containerPath: '/tmp/carryover',
  profileFound: true,
  profileName: 'Carryover Development',
  teamIdentifier: 'TEAM123',
  entitlementKeys: ['com.apple.security.application-groups'],
  entitlements: {
    'com.apple.security.application-groups': 'group.com.example.carryover',
  },
};

const mockUseMigrations = jest.fn();
const mockPushFixtureToWidget = jest.fn();
const mockStopBudgetSnapshotPublication = jest.fn();
const mockStartBudgetSnapshotPublication = jest.fn(
  () => mockStopBudgetSnapshotPublication
);

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  Stack: () => null,
}));

jest.mock('../src/ui/ledger-access', () => ({
  useLedgerMigrations: () => mockUseMigrations(),
  startBudgetSnapshotPublication: () => mockStartBudgetSnapshotPublication(),
}));

jest.mock('../src/ui/diagnostics/runtime-diagnostics', () => ({
  readSigningFacts: () => mockSigningFacts,
  pushFixtureToWidget: () => mockPushFixtureToWidget(),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

import NativeRootLayout from '../src/app/_layout';
import WebRootLayout from '../src/app/_layout.web';
import StageZeroScreen from '../src/app/index';

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

beforeEach(() => {
  mockUseMigrations.mockReturnValue({ success: false, error: undefined });
  mockPushFixtureToWidget.mockResolvedValue({ status: 'pushed', timelineEntries: 1 });
});

test('shows the migration loading state before the ledger is ready', async () => {
  await render(<NativeRootLayout />);

  expect(screen.getByText('Applying the ledger schema…')).toBeTruthy();
  expect(screen.queryByText('Signing facts')).toBeNull();
  expect(screen.queryByText('Push ₫12k to widget')).toBeNull();
});

test('shows a migration error and keeps the route tree unavailable', async () => {
  mockUseMigrations.mockReturnValue({
    success: false,
    error: new Error('database is locked'),
  });

  await render(<NativeRootLayout />);

  expect(screen.getByText('Migration failed: database is locked')).toBeTruthy();
  expect(screen.queryByText('Signing facts')).toBeNull();
  expect(screen.queryByText('Push ₫12k to widget')).toBeNull();
});

test('pushes the widget snapshot through the native boundary', async () => {
  mockUseMigrations.mockReturnValue({ success: true, error: undefined });

  await render(<StageZeroScreen />);
  const user = userEvent.setup();
  await user.press(screen.getByText('Push ₫12k to widget'));

  expect(mockPushFixtureToWidget).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('Wrote ₫12k and read back 1 entry(s). Check the widget.')).toBeTruthy();
});

test('mounts the native stack only after migration succeeds', async () => {
  mockUseMigrations.mockReturnValue({ success: true, error: undefined });

  const view = await render(<NativeRootLayout />);

  expect(screen.queryByText('Applying the ledger schema…')).toBeNull();
  expect(screen.queryByText('Migration failed: database is locked')).toBeNull();
  expect(mockStartBudgetSnapshotPublication).toHaveBeenCalledTimes(1);

  await view.unmount();
  expect(mockStopBudgetSnapshotPublication).toHaveBeenCalledTimes(1);
});

test('mounts the browser stack without opening the ledger', async () => {
  await render(<WebRootLayout />);

  expect(mockUseMigrations).not.toHaveBeenCalled();
});

test('labels the browser as a preview without opening the ledger', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  await render(<StageZeroScreen />);

  expect(
    screen.getByText('Browser preview. The ledger and iOS widget are not connected.')
  ).toBeTruthy();
  expect(mockUseMigrations).not.toHaveBeenCalled();
});
