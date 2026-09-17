import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Linking } from 'react-native';

import type {
  DraftNudgeServiceState,
} from '../src/notifications/draft-nudge-contract';
import type {
  DraftNudgeService,
  DraftNudgeServiceBindings,
} from '../src/notifications/draft-nudge-service';
import { DraftNudgeControl } from '../src/ui/notifications/DraftNudgeControl';

jest.mock('../src/notifications/draft-nudge-access', () => ({
  getDraftNudgeService: jest.fn(),
}));

type ControlHarness = {
  service: DraftNudgeService;
  setState: (state: DraftNudgeServiceState) => void;
  requestPermission: jest.Mock<Promise<void>, []>;
  retry: jest.Mock<Promise<void>, []>;
};

function controlHarness(initialState: DraftNudgeServiceState): ControlHarness {
  let state = initialState;
  let listener: ((next: DraftNudgeServiceState) => void) | undefined;
  const requestPermission = jest.fn<Promise<void>, []>(async () => undefined);
  const retry = jest.fn<Promise<void>, []>(async () => undefined);
  const service: DraftNudgeService = {
    getState: () => state,
    subscribe: (next) => {
      listener = next;
      return () => {
        if (listener === next) listener = undefined;
      };
    },
    start: (_bindings: DraftNudgeServiceBindings) => () => undefined,
    reconcile: jest.fn(async () => undefined),
    retry,
    requestPermission,
    subscribeToResponses: (_listener) => () => undefined,
    readLastResponse: () => null,
    clearLastResponse: jest.fn(),
    dispose: jest.fn(),
  };
  return {
    service,
    setState: (next) => {
      state = next;
      listener?.(next);
    },
    requestPermission,
    retry,
  };
}

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

test('shows contextual permission copy and requests access only after an explicit action', async () => {
  const harness = controlHarness({
    status: 'permission-required',
    eligibility: { status: 'has-unknowns' },
    permission: { status: 'requestable', canAskAgain: true },
  });

  await render(<DraftNudgeControl service={harness.service} />);

  expect(screen.getByText('Daily reminders are off')).toBeTruthy();
  expect(screen.getByText('Remind me at 20:00 while drafts have an unknown amount.')).toBeTruthy();
  expect(harness.requestPermission).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: 'Enable daily reminder' }));
  expect(harness.requestPermission).toHaveBeenCalledTimes(1);
});

test('shows progress, quiet-enabled delivery, and the denied settings path', async () => {
  const harness = controlHarness({
    status: 'checking',
    eligibility: { status: 'has-unknowns' },
    operation: 'startup',
  });
  const view = await render(<DraftNudgeControl service={harness.service} />);

  expect(screen.getByText('Checking daily reminder…')).toBeTruthy();
  await act(async () => {
    harness.setState({
      status: 'enabled',
      eligibility: { status: 'has-unknowns' },
      permission: { status: 'allowed', quiet: true },
    });
  });
  await waitFor(() =>
    expect(screen.getByText('Daily reminders are on, but delivery may be quiet.')).toBeTruthy()
  );

  const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  await act(async () => {
    harness.setState({
      status: 'denied',
      eligibility: { status: 'has-unknowns' },
      permission: { status: 'denied', canAskAgain: false },
    });
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Open notification settings' })).toBeTruthy()
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Open notification settings' }));
  expect(openSettings).toHaveBeenCalledTimes(1);

  await view.unmount();
});

test('keeps reminder errors recoverable without hiding the inbox action', async () => {
  const harness = controlHarness({
    status: 'error',
    eligibility: { status: 'has-unknowns' },
    operation: 'notifications',
    message: 'The notification center is unavailable.',
  });
  harness.retry.mockRejectedValueOnce(new Error('retry failed'));

  await render(<DraftNudgeControl service={harness.service} />);

  expect(screen.getByText('Daily reminder unavailable')).toBeTruthy();
  expect(screen.getByText('The notification center is unavailable.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() =>
    expect(screen.getByText('Could not retry the daily reminder: retry failed')).toBeTruthy()
  );
});

test('does not render a reminder panel after the last unknown is resolved', async () => {
  const harness = controlHarness({
    status: 'idle',
    eligibility: { status: 'none' },
    reason: 'no-unknowns',
  });

  await render(<DraftNudgeControl service={harness.service} />);

  expect(screen.queryByTestId('draft-nudge-control')).toBeNull();
});
