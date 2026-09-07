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
const mockUpdateSnapshot = jest.fn();
const mockReload = jest.fn();
const mockGetTimeline = jest.fn();

jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: (...args: unknown[]) => mockUseMigrations(...args),
}));

jest.mock('../src/data/database', () => ({
  ledgerDb: {},
  ledgerMigrations: {},
}));

jest.mock('../widgets/CarryoverWidget', () => ({
  CarryoverWidget: {
    updateSnapshot: (...args: unknown[]) => mockUpdateSnapshot(...args),
    reload: (...args: unknown[]) => mockReload(...args),
    getTimeline: (...args: unknown[]) => mockGetTimeline(...args),
  },
}));

jest.mock('expo-modules-core', () => ({
  requireNativeModule: () => ({ signingFacts: mockSigningFacts }),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

import App from '../App';

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
  mockGetTimeline.mockResolvedValue([{ perDay: 12_000, runwayDays: 7, unloggedDrafts: 0 }]);
});

beforeEach(() => {
  mockUseMigrations.mockReturnValue({ success: false, error: undefined });
  mockGetTimeline.mockResolvedValue([{ perDay: 12_000, runwayDays: 7, unloggedDrafts: 0 }]);
});

test('shows the migration loading state before the ledger is ready', async () => {
  await render(<App />);

  expect(screen.getByText('Applying the ledger schema…')).toBeTruthy();
  expect(screen.queryByText('Signing facts')).toBeNull();
  expect(screen.queryByText('Push ₫12k to widget')).toBeNull();
});

test('shows a migration error and keeps the app screen unavailable', async () => {
  mockUseMigrations.mockReturnValue({
    success: false,
    error: new Error('database is locked'),
  });

  await render(<App />);

  expect(screen.getByText('Migration failed: database is locked')).toBeTruthy();
  expect(screen.queryByText('Signing facts')).toBeNull();
  expect(screen.queryByText('Push ₫12k to widget')).toBeNull();
});

test('pushes the widget snapshot through the native boundary', async () => {
  mockUseMigrations.mockReturnValue({ success: true, error: undefined });

  await render(<App />);
  const user = userEvent.setup();
  await user.press(screen.getByText('Push ₫12k to widget'));

  expect(mockUpdateSnapshot).toHaveBeenCalledWith({
    perDay: 12_000,
    runwayDays: 7,
    unloggedDrafts: 0,
  });
  expect(mockReload).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('Wrote ₫12k and read back 1 entry(s). Check the widget.')).toBeTruthy();
});
