import { cleanup, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockUseMigrations = jest.fn();
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

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

import NativeRootLayout from '../src/app/_layout';
import WebRootLayout from '../src/app/_layout.web';

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

beforeEach(() => {
  mockUseMigrations.mockReturnValue({ success: false, error: undefined });
});

test('shows the migration loading state before the ledger is ready', async () => {
  await render(<NativeRootLayout />);

  expect(screen.getByText('Applying the ledger schema…')).toBeTruthy();
  expect(screen.queryByText('Home')).toBeNull();
});

test('shows a migration error and keeps the route tree unavailable', async () => {
  mockUseMigrations.mockReturnValue({
    success: false,
    error: new Error('database is locked'),
  });

  await render(<NativeRootLayout />);

  expect(screen.getByText('Migration failed: database is locked')).toBeTruthy();
  expect(screen.queryByText('Home')).toBeNull();
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
