import { cleanup, render, screen, userEvent } from '@testing-library/react-native';

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

jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: (...args: unknown[]) => mockUseMigrations(...args),
}));

jest.mock('expo-router', () => ({
  Stack: () => null,
}));

jest.mock('../src/data/database', () => ({
  ledgerDb: {},
  ledgerMigrations: {},
}));

jest.mock('../src/screens/diagnostics/runtime-diagnostics', () => ({
  readSigningFacts: () => mockSigningFacts,
  pushFixtureToWidget: () => mockPushFixtureToWidget(),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

import NativeRootLayout from '../src/screens/RootLayout';
import WebRootLayout from '../src/screens/RootLayout.web';
import { StageZeroScreen } from '../src/screens/diagnostics/StageZeroScreen';
import WebStageZeroRoute from '../src/screens/diagnostics/StageZeroRoute.web';

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
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

  await render(<NativeRootLayout />);

  expect(screen.queryByText('Applying the ledger schema…')).toBeNull();
  expect(screen.queryByText('Migration failed: database is locked')).toBeNull();
});

test('mounts the browser stack without opening the ledger', async () => {
  await render(<WebRootLayout />);

  expect(mockUseMigrations).not.toHaveBeenCalled();
});

test('labels the browser as a preview without opening the ledger', async () => {
  await render(<WebStageZeroRoute />);

  expect(
    screen.getByText('Browser preview. The ledger and iOS widget are not connected.')
  ).toBeTruthy();
  expect(mockUseMigrations).not.toHaveBeenCalled();
});
