import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { FIXTURE_SNAPSHOT } from '../src/budget/snapshot';
import { snapshotStore } from '../src/budget/snapshot-store';
import type { MonthConfig } from '../src/data/month-config-validation';
import type { HorizonEditorData } from '../src/ui/horizon/horizon-editor-contract';
import NativeHorizonRoute from '../src/app/horizon';
import WebHorizonRoute from '../src/app/horizon.web';

const mockParams = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockUsePreventRemove = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack(),
  },
  useLocalSearchParams: () => mockParams(),
}));

jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (...args: unknown[]) => mockUsePreventRemove(...args),
}));

jest.mock('../src/ui/ledger-access', () => ({
  getHorizonEditorData: jest.fn(),
  retryBudgetSnapshot: jest.fn(async () => undefined),
}));

const config: MonthConfig = {
  period: '2026-09',
  openingBalance: 1_000_000,
  incomeTotal: 2_000_000,
  reservedTotal: 300_000,
  horizonDate: '2026-09-30',
};

function snapshotReady(): void {
  snapshotStore.setState({ status: 'ready', snapshot: FIXTURE_SNAPSHOT }, true);
}

function routeData(
  readMonthConfig: HorizonEditorData['readMonthConfig'] = jest.fn(async () => config),
  updateHorizon: HorizonEditorData['updateHorizon'] = jest.fn(async () => config)
): HorizonEditorData {
  return { readMonthConfig, updateHorizon };
}

afterEach(() => {
  cleanup();
  snapshotStore.setState({ status: 'loading' }, true);
  mockParams.mockReset();
  mockReplace.mockReset();
  mockBack.mockReset();
  mockCanGoBack.mockReturnValue(true);
  mockUsePreventRemove.mockReset();
});

test('loads the pinned period and saves an exact beyond-period date to Home', async () => {
  mockParams.mockReturnValue({ period: '2026-09' });
  const updateHorizon = jest.fn(async () => ({ ...config, horizonDate: '2026-10-15' }));
  const view = await render(
    <NativeHorizonRoute
      data={routeData(jest.fn(async () => config), updateHorizon)}
      now={() => new Date(2026, 8, 15)}
    />
  );

  await waitFor(() => expect(view.getByText('Change horizon')).toBeTruthy());
  expect(view.getByText('Period: September 2026')).toBeTruthy();
  await fireEvent.changeText(view.getByLabelText('Horizon'), '2026-10-15');
  await fireEvent.press(view.getByRole('button', { name: 'Save horizon' }));

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  expect(updateHorizon).toHaveBeenCalledTimes(1);
  expect(updateHorizon).toHaveBeenCalledWith({
    period: '2026-09',
    horizonDate: '2026-10-15',
  });
});

test('rejects malformed and repeated period parameters before reading', async () => {
  mockParams.mockReturnValue({ period: ['2026-09', '2026-10'] });
  const readMonthConfig = jest.fn(async () => config);
  await render(<NativeHorizonRoute data={routeData(readMonthConfig)} />);

  expect(screen.getByText('Invalid horizon link')).toBeTruthy();
  expect(readMonthConfig).not.toHaveBeenCalled();
});

test('normalizes an omitted period once and keeps the target pinned across midnight', async () => {
  mockParams.mockReturnValue({ period: undefined });
  const readMonthConfig = jest.fn(async () => config);
  const updateHorizon = jest.fn(async () => config);
  const now = jest.fn(() => new Date(2026, 8, 30, 23, 59));
  const view = await render(
    <NativeHorizonRoute
      data={routeData(readMonthConfig, updateHorizon)}
      now={now}
    />
  );

  await waitFor(() => expect(view.getByText('Period: September 2026')).toBeTruthy());
  expect(mockReplace).toHaveBeenCalledWith('/horizon?period=2026-09');
  expect(now).toHaveBeenCalledTimes(1);

  await fireEvent.changeText(view.getByLabelText('Horizon'), '2026-10-15');
  await fireEvent.press(view.getByRole('button', { name: 'Save horizon' }));
  await waitFor(() => expect(updateHorizon).toHaveBeenCalledWith({
    period: '2026-09',
    horizonDate: '2026-10-15',
  }));
});

test('waits for current-period preparation, then reports a missing historical row as unavailable', async () => {
  mockParams.mockReturnValue({ period: '2026-09' });
  const readMonthConfig = jest.fn(async () => undefined);
  const view = await render(
    <NativeHorizonRoute
      data={routeData(readMonthConfig)}
      now={() => new Date(2026, 8, 15)}
    />
  );

  expect(view.getByText('Loading the stored horizon for 2026-09…')).toBeTruthy();
  await act(async () => snapshotReady());
  await waitFor(() => expect(view.getByText('Horizon unavailable')).toBeTruthy());
  expect(readMonthConfig).toHaveBeenCalledTimes(2);
  expect(view.queryByText('2026-09-30')).toBeNull();
});

test('read failures keep the route open and retry without changing the period', async () => {
  mockParams.mockReturnValue({ period: '2026-09' });
  const readMonthConfig = jest
    .fn<ReturnType<HorizonEditorData['readMonthConfig']>, Parameters<HorizonEditorData['readMonthConfig']>>()
    .mockRejectedValueOnce(new Error('month config unavailable'))
    .mockResolvedValue(config);
  const view = await render(<NativeHorizonRoute data={routeData(readMonthConfig)} />);

  await waitFor(() => expect(view.getByText('month config unavailable')).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(view.getByLabelText('Horizon').props.value).toBe('2026-09-30'));
  expect(readMonthConfig).toHaveBeenCalledWith('2026-09');
});

test('background publication refreshes do not remount or replace dirty input', async () => {
  mockParams.mockReturnValue({ period: '2026-09' });
  const readMonthConfig = jest.fn(async () => config);
  const view = await render(<NativeHorizonRoute data={routeData(readMonthConfig)} />);
  await waitFor(() => expect(view.getByLabelText('Horizon')).toBeTruthy());
  await fireEvent.changeText(view.getByLabelText('Horizon'), '2026-10-15');

  await act(async () => {
    snapshotStore.setState({ status: 'loading' }, true);
    snapshotStore.setState({ status: 'ready', snapshot: FIXTURE_SNAPSHOT }, true);
  });

  expect(view.getByLabelText('Horizon').props.value).toBe('2026-10-15');
  expect(readMonthConfig).toHaveBeenCalledTimes(1);
});

test('removal guard blocks back and editing during a deferred save, then releases', async () => {
  mockParams.mockReturnValue({ period: '2026-09' });
  let resolveWrite: () => void = () => undefined;
  const write = new Promise<MonthConfig>((resolve) => {
    resolveWrite = () => resolve(config);
  });
  const updateHorizon = jest.fn(() => write);
  const view = await render(
    <NativeHorizonRoute data={routeData(jest.fn(async () => config), updateHorizon)} />
  );
  await waitFor(() => expect(view.getByLabelText('Horizon')).toBeTruthy());

  await fireEvent.changeText(view.getByLabelText('Horizon'), '2026-10-15');
  await fireEvent.press(view.getByRole('button', { name: 'Save horizon' }));
  const pendingCall = mockUsePreventRemove.mock.calls[mockUsePreventRemove.mock.calls.length - 1];
  expect(pendingCall?.[0]).toBe(true);
  if (typeof pendingCall?.[1] !== 'function') throw new Error('Expected removal guard callback');
  pendingCall[1]({ data: { action: { type: 'GO_BACK' } } });

  expect(view.getByLabelText('Horizon').props.editable).toBe(false);
  expect(view.getByRole('button', { name: 'Cancel' }).props.accessibilityState.disabled).toBe(true);
  expect(mockBack).not.toHaveBeenCalled();

  await act(async () => {
    resolveWrite();
    await write;
  });
  await waitFor(() => {
    const latest = mockUsePreventRemove.mock.calls[mockUsePreventRemove.mock.calls.length - 1];
    expect(latest?.[0]).toBe(false);
  });
});

test('cancel leaves the write boundary untouched', async () => {
  mockParams.mockReturnValue({ period: '2026-09' });
  const updateHorizon = jest.fn(async () => config);
  const view = await render(<NativeHorizonRoute data={routeData(jest.fn(async () => config), updateHorizon)} />);
  await waitFor(() => expect(view.getByLabelText('Horizon')).toBeTruthy());

  await fireEvent.press(view.getByRole('button', { name: 'Cancel' }));

  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(updateHorizon).not.toHaveBeenCalled();
});

test('browser route uses the fixture and saves in memory without native ledger access', async () => {
  mockParams.mockReturnValue({ period: '2026-09' });
  const view = await render(<WebHorizonRoute />);

  await waitFor(() => expect(view.getByLabelText('Horizon')).toBeTruthy());
  expect(view.getByLabelText('Horizon').props.value).toBe('2026-09-30');
  await fireEvent.changeText(view.getByLabelText('Horizon'), '2026-10-15');
  await fireEvent.press(view.getByRole('button', { name: 'Save horizon' }));

  await waitFor(() => expect(view.getByText('Horizon saved in this browser preview.')).toBeTruthy());
});
