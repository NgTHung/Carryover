import {
  act,
  cleanup,
  render,
  waitFor,
} from '@testing-library/react-native';
import { AppState } from 'react-native';

import type {
  DraftNudgeResponse,
  DraftNudgeServiceState,
} from '../src/notifications/draft-nudge-contract';
import {
  DRAFT_NUDGE_DEFAULT_ACTION_IDENTIFIER,
  DRAFT_NUDGE_IDENTIFIER,
  DRAFT_NUDGE_PAYLOAD,
} from '../src/notifications/draft-nudge-policy';
import type {
  DraftNudgeService,
  DraftNudgeServiceBindings,
} from '../src/notifications/draft-nudge-service';
import { DraftNudgeLifecycle } from '../src/ui/notifications/DraftNudgeLifecycle';

const mockPush = jest.fn();
const mockStartDraftNudgeService = jest.fn(() => () => undefined);

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
  usePathname: () => '/',
  useRootNavigationState: () => ({ key: 'root' }),
}));

jest.mock('../src/notifications/draft-nudge-access', () => ({
  getDraftNudgeService: jest.fn(),
  startDraftNudgeService: () => mockStartDraftNudgeService(),
}));

type NavigationHarness = {
  service: DraftNudgeService;
  emit: (response: DraftNudgeResponse) => void;
  setRetained: (response: DraftNudgeResponse | null) => void;
  responseSubscription: jest.Mock;
  readLastResponse: jest.Mock;
  clearLastResponse: jest.Mock;
};

function response(deliveredAt: number): DraftNudgeResponse {
  return {
    requestIdentifier: DRAFT_NUDGE_IDENTIFIER,
    deliveredAt,
    actionIdentifier: DRAFT_NUDGE_DEFAULT_ACTION_IDENTIFIER,
    data: DRAFT_NUDGE_PAYLOAD,
  };
}

function navigationHarness(retained: DraftNudgeResponse | null = null): NavigationHarness {
  let currentRetained = retained;
  let listener: ((next: DraftNudgeResponse) => void) | undefined;
  const responseSubscription = jest.fn((next: (response: DraftNudgeResponse) => void) => {
    listener = next;
    return () => {
      if (listener === next) listener = undefined;
    };
  });
  const readLastResponse = jest.fn(() => currentRetained);
  const clearLastResponse = jest.fn(() => {
    currentRetained = null;
  });
  const state: DraftNudgeServiceState = {
    status: 'idle',
    eligibility: { status: 'none' },
    reason: 'no-unknowns',
  };
  const service: DraftNudgeService = {
    getState: () => state,
    subscribe: () => () => undefined,
    start: (_bindings: DraftNudgeServiceBindings) => () => undefined,
    reconcile: jest.fn(async () => undefined),
    retry: jest.fn(async () => undefined),
    requestPermission: jest.fn(async () => undefined),
    subscribeToResponses: responseSubscription,
    readLastResponse,
    clearLastResponse,
    dispose: jest.fn(),
  };
  return {
    service,
    emit: (next) => listener?.(next),
    setRetained: (next) => {
      currentRetained = next;
    },
    responseSubscription,
    readLastResponse,
    clearLastResponse,
  };
}

let appStateListener: ((state: string) => void) | undefined;

beforeEach(() => {
  appStateListener = undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appStateListener = listener as (state: string) => void;
    return { remove: jest.fn() };
  });
});

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
  mockPush.mockReset();
  mockStartDraftNudgeService.mockClear();
});

test('registers the live listener before reading a retained response and waits for navigation readiness', async () => {
  const order: string[] = [];
  const harness = navigationHarness(response(1_700_000_000_001));
  harness.responseSubscription.mockImplementationOnce((listener: (response: DraftNudgeResponse) => void) => {
    order.push('subscribe');
    return (() => undefined);
  });
  harness.readLastResponse.mockImplementationOnce(() => {
    order.push('read');
    return response(1_700_000_000_001);
  });

  const view = await render(
    <DraftNudgeLifecycle
      service={harness.service}
      navigationReady={false}
      pathname="/"
    />
  );

  expect(order).toEqual(['subscribe', 'read']);
  expect(mockStartDraftNudgeService).toHaveBeenCalledTimes(1);
  expect(mockPush).not.toHaveBeenCalled();

  await view.rerender(
    <DraftNudgeLifecycle
      service={harness.service}
      navigationReady
      pathname="/"
    />
  );
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/drafts'));

  await view.rerender(
    <DraftNudgeLifecycle
      service={harness.service}
      navigationReady
      pathname="/drafts"
    />
  );
  await waitFor(() => expect(harness.clearLastResponse).toHaveBeenCalledTimes(1));
});

test('deduplicates retained and live delivery events, but accepts a later day', async () => {
  const harness = navigationHarness();
  const firstDelivery = response(1_700_000_000_101);
  const view = await render(
    <DraftNudgeLifecycle service={harness.service} navigationReady pathname="/" />
  );

  await act(async () => {
    harness.setRetained(firstDelivery);
    harness.emit(firstDelivery);
  });
  await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));

  await view.rerender(
    <DraftNudgeLifecycle service={harness.service} navigationReady pathname="/drafts" />
  );
  await waitFor(() => expect(harness.clearLastResponse).toHaveBeenCalledTimes(1));

  await view.rerender(
    <DraftNudgeLifecycle service={harness.service} navigationReady pathname="/" />
  );
  await act(async () => {
    harness.emit(firstDelivery);
    harness.emit(response(1_700_086_400_101));
  });
  await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(2));
});

test('does not clear a newer retained response while confirming an older delivery', async () => {
  const oldResponse = response(1_700_000_000_201);
  const newerResponse = response(1_700_000_000_202);
  const harness = navigationHarness(oldResponse);
  let confirming = false;
  harness.readLastResponse.mockImplementation(() =>
    confirming ? newerResponse : oldResponse
  );

  const view = await render(
    <DraftNudgeLifecycle service={harness.service} navigationReady pathname="/" />
  );
  await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));

  confirming = true;
  await view.rerender(
    <DraftNudgeLifecycle service={harness.service} navigationReady pathname="/drafts" />
  );
  await act(async () => undefined);

  expect(harness.clearLastResponse).not.toHaveBeenCalled();
  expect(harness.readLastResponse).toHaveBeenCalledTimes(2);
});

test('retains a navigation intent after a router failure and retries on foreground recovery', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  mockPush.mockImplementationOnce(() => {
    throw new Error('router unavailable');
  });
  const harness = navigationHarness();

  await render(
    <DraftNudgeLifecycle service={harness.service} navigationReady pathname="/" />
  );
  await act(async () => {
    harness.emit(response(1_700_000_000_301));
  });
  await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));

  await act(async () => {
    appStateListener?.('active');
  });
  await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(2));
  expect(consoleError).toHaveBeenCalledWith(
    'Could not open Drafts from the daily reminder',
    expect.any(Error)
  );
});
