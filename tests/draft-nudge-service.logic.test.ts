import type {
  DraftNudgeAdapter,
  DraftNudgePermission,
  DraftNudgeSchedule,
  DraftNudgeScheduledRequest,
} from '../src/notifications/draft-nudge-contract';
import { DRAFT_NUDGE_SCHEDULE } from '../src/notifications/draft-nudge-policy';
import {
  createDraftNudgeService,
  type DraftNudgeAppState,
  type DraftNudgeService,
  type DraftNudgeServiceBindings,
} from '../src/notifications/draft-nudge-service';

function scheduledRequest(
  schedule: DraftNudgeSchedule = DRAFT_NUDGE_SCHEDULE,
  identifier = schedule.identifier
): DraftNudgeScheduledRequest {
  return {
    identifier,
    content: {
      title: schedule.title,
      body: schedule.body,
      data: schedule.data,
      sound: 'none',
      badge: null,
    },
    trigger: {
      kind: 'daily',
      repeats: true,
      hour: schedule.trigger.hour,
      minute: schedule.trigger.minute,
    },
  };
}

type FakeAdapter = {
  adapter: DraftNudgeAdapter;
  requests: DraftNudgeScheduledRequest[];
  calls: string[];
  setPermission: (permission: DraftNudgePermission) => void;
  setScheduleImplementation: (
    implementation: (schedule: DraftNudgeSchedule) => Promise<string>
  ) => void;
};

function fakeAdapter(
  initialPermission: DraftNudgePermission = { status: 'requestable', canAskAgain: true },
  initialRequests: DraftNudgeScheduledRequest[] = []
): FakeAdapter {
  let permission = initialPermission;
  const requests = [...initialRequests];
  const calls: string[] = [];
  let scheduleImplementation = async (schedule: DraftNudgeSchedule): Promise<string> => {
    calls.push('schedule');
    requests.push(scheduledRequest(schedule));
    return schedule.identifier;
  };

  const adapter: DraftNudgeAdapter = {
    inspectPermission: jest.fn(async () => permission),
    requestPermission: jest.fn(async () => {
      calls.push('request-permission');
      permission = { status: 'allowed', quiet: false };
      return permission;
    }),
    listScheduled: jest.fn(async () => requests.slice()),
    scheduleDailyNudge: jest.fn((schedule) => scheduleImplementation(schedule)),
    cancelScheduled: jest.fn(async (identifier: string) => {
      calls.push(`cancel:${identifier}`);
      const index = requests.findIndex((request) => request.identifier === identifier);
      if (index >= 0) requests.splice(index, 1);
    }),
    subscribeToResponses: jest.fn(() => () => undefined),
    readLastResponse: jest.fn(() => null),
    clearLastResponse: jest.fn(),
    dismissOwnedDelivered: jest.fn(async () => {
      calls.push('dismiss-delivered');
    }),
    configureForegroundPresentation: jest.fn(() => undefined),
  };

  return {
    adapter,
    requests,
    calls,
    setPermission: (next) => {
      permission = next;
    },
    setScheduleImplementation: (next) => {
      scheduleImplementation = next;
    },
  };
}

type LifecycleHarness = {
  bindings: DraftNudgeServiceBindings;
  emitLedger: () => void;
  emitAppState: (state: string) => void;
  removeLedger: jest.Mock;
  removeAppState: jest.Mock;
};

function lifecycleHarness(): LifecycleHarness {
  let ledgerListener: (() => void) | undefined;
  let appStateListener: ((state: string) => void) | undefined;
  const removeLedger = jest.fn();
  const removeAppState = jest.fn();
  const appState: DraftNudgeAppState = {
    currentState: 'active',
    addEventListener: jest.fn((_event, listener) => {
      appStateListener = listener;
      return { remove: removeAppState };
    }),
  };
  return {
    bindings: {
      subscribeToLedger: jest.fn((listener: () => void) => {
        ledgerListener = listener;
        return removeLedger;
      }),
      appState,
    },
    emitLedger: () => ledgerListener?.(),
    emitAppState: (state) => appStateListener?.(state),
    removeLedger,
    removeAppState,
  };
}

function tick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

async function waitForState(
  service: DraftNudgeService,
  predicate: (serviceState: ReturnType<DraftNudgeService['getState']>) => boolean
): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (predicate(service.getState())) return;
    await tick();
  }
  throw new Error(`Timed out waiting for state ${service.getState().status}`);
}

const services: DraftNudgeService[] = [];

function createService(
  hasUnknownDrafts: () => Promise<boolean>,
  fake: FakeAdapter
): { service: DraftNudgeService; lifecycle: LifecycleHarness } {
  const service = createDraftNudgeService({
    readHasUnknownDrafts: hasUnknownDrafts,
    adapter: fake.adapter,
  });
  services.push(service);
  const lifecycle = lifecycleHarness();
  return { service, lifecycle };
}

afterEach(() => {
  for (const service of services.splice(0)) service.dispose();
  jest.clearAllMocks();
});

test('startup reads unknown eligibility without prompting and exposes contextual permission state', async () => {
  const fake = fakeAdapter();
  const read = jest.fn(async () => true);
  const { service, lifecycle } = createService(read, fake);

  service.start(lifecycle.bindings);
  await waitForState(service, (state) => state.status === 'permission-required');

  expect(read).toHaveBeenCalledTimes(1);
  expect(fake.adapter.requestPermission).not.toHaveBeenCalled();
  expect(service.getState()).toEqual({
    status: 'permission-required',
    eligibility: { status: 'has-unknowns' },
    permission: { status: 'requestable', canAskAgain: true },
  });
});

test('an explicit permission action requests once and does not show enabled until schedule inspection succeeds', async () => {
  const fake = fakeAdapter();
  const { service, lifecycle } = createService(jest.fn(async () => true), fake);
  service.start(lifecycle.bindings);
  await waitForState(service, (state) => state.status === 'permission-required');

  await service.requestPermission();
  await waitForState(service, (state) => state.status === 'enabled');

  expect(fake.adapter.requestPermission).toHaveBeenCalledTimes(1);
  expect(fake.adapter.scheduleDailyNudge).toHaveBeenCalledTimes(1);
});

test('duplicate repair cancels every owned request before scheduling and preserves unrelated requests', async () => {
  const duplicate = scheduledRequest(DRAFT_NUDGE_SCHEDULE, 'duplicate');
  const obsolete = scheduledRequest({
    ...DRAFT_NUDGE_SCHEDULE,
    trigger: { kind: 'daily', hour: 21, minute: 0 },
  });
  const unrelated: DraftNudgeScheduledRequest = {
    ...duplicate,
    identifier: 'unrelated',
    content: { ...duplicate.content, data: { kind: 'other' } },
  };
  const fake = fakeAdapter({ status: 'allowed', quiet: false }, [duplicate, obsolete, unrelated]);
  const { service, lifecycle } = createService(jest.fn(async () => true), fake);
  service.start(lifecycle.bindings);
  await waitForState(service, (state) => state.status === 'enabled');

  expect(fake.calls).toEqual([
    'cancel:carryover.unknown-drafts.daily.v1',
    'cancel:duplicate',
    'schedule',
  ]);
  expect(fake.requests.map((request) => request.identifier)).toEqual([
    'unrelated',
    DRAFT_NUDGE_SCHEDULE.identifier,
  ]);
});

test('the last unknown cancels the reminder and cleans delivered notifications without touching unrelated requests', async () => {
  let hasUnknownDrafts = true;
  const unrelated = scheduledRequest(DRAFT_NUDGE_SCHEDULE, 'unrelated');
  unrelated.content.data = { kind: 'other' };
  const fake = fakeAdapter({ status: 'allowed', quiet: false }, [
    scheduledRequest(),
    unrelated,
  ]);
  const { service, lifecycle } = createService(
    jest.fn(async () => hasUnknownDrafts),
    fake
  );
  service.start(lifecycle.bindings);
  await waitForState(service, (state) => state.status === 'enabled');

  hasUnknownDrafts = false;
  lifecycle.emitLedger();
  await waitForState(service, (state) => state.status === 'idle');

  expect(fake.calls).toContain('cancel:carryover.unknown-drafts.daily.v1');
  expect(fake.calls).toContain('dismiss-delivered');
  expect(fake.requests.map((request) => request.identifier)).toEqual(['unrelated']);
});

test('a stale eligibility read is discarded before permission or OS side effects', async () => {
  let resolveFirst: (value: boolean) => void = () => undefined;
  const firstRead = new Promise<boolean>((resolve) => {
    resolveFirst = resolve;
  });
  const read = jest.fn().mockReturnValueOnce(firstRead).mockResolvedValueOnce(false);
  const fake = fakeAdapter({ status: 'allowed', quiet: false });
  const { service, lifecycle } = createService(read, fake);
  service.start(lifecycle.bindings);
  for (let attempt = 0; attempt < 40 && read.mock.calls.length === 0; attempt += 1) {
    await tick();
  }
  lifecycle.emitLedger();
  resolveFirst(true);

  await waitForState(service, (state) => state.status === 'idle');
  expect(read).toHaveBeenCalledTimes(2);
  expect(fake.adapter.scheduleDailyNudge).not.toHaveBeenCalled();
});

test('a completion during scheduling settles the old write, then cancels from a fresh read', async () => {
  let hasUnknownDrafts = true;
  let resolveSchedule: (identifier: string) => void = () => undefined;
  const scheduleResult = new Promise<string>((resolve) => {
    resolveSchedule = resolve;
  });
  const fake = fakeAdapter({ status: 'allowed', quiet: false });
  fake.setScheduleImplementation(async (schedule) => {
    fake.calls.push('schedule-started');
    const identifier = await scheduleResult;
    fake.requests.push(scheduledRequest(schedule));
    return identifier;
  });
  const { service, lifecycle } = createService(
    jest.fn(async () => hasUnknownDrafts),
    fake
  );
  service.start(lifecycle.bindings);
  await waitForState(service, (state) => fake.calls.includes('schedule-started'));

  hasUnknownDrafts = false;
  lifecycle.emitLedger();
  resolveSchedule(DRAFT_NUDGE_SCHEDULE.identifier);
  await waitForState(service, (state) => state.status === 'idle');

  expect(fake.adapter.scheduleDailyNudge).toHaveBeenCalledTimes(1);
  expect(fake.requests).toHaveLength(0);
});

test('cancellation failure prevents a replacement schedule, and explicit retry repairs it', async () => {
  const fake = fakeAdapter({ status: 'allowed', quiet: false }, [scheduledRequest({
    ...DRAFT_NUDGE_SCHEDULE,
    body: 'Old body',
  })]);
  const cancel = fake.adapter.cancelScheduled;
  let fail = true;
  fake.adapter.cancelScheduled = jest.fn(async (identifier: string) => {
    if (fail) throw new Error(`cannot cancel ${identifier}`);
    await cancel(identifier);
  });
  const { service, lifecycle } = createService(jest.fn(async () => true), fake);
  service.start(lifecycle.bindings);
  await waitForState(service, (state) => state.status === 'error');
  expect(fake.adapter.scheduleDailyNudge).not.toHaveBeenCalled();

  fail = false;
  await service.retry();
  await waitForState(service, (state) => state.status === 'enabled');
  expect(fake.adapter.scheduleDailyNudge).toHaveBeenCalledTimes(1);
});

test('a rejected schedule is recovered by inspection instead of blindly enqueueing another request', async () => {
  const fake = fakeAdapter({ status: 'allowed', quiet: false });
  let first = true;
  fake.setScheduleImplementation(async (schedule) => {
    fake.requests.push(scheduledRequest(schedule));
    if (first) {
      first = false;
      throw new Error('OS result uncertain');
    }
    return schedule.identifier;
  });
  const { service, lifecycle } = createService(jest.fn(async () => true), fake);
  service.start(lifecycle.bindings);
  await waitForState(service, (state) => state.status === 'error');

  await service.retry();
  await waitForState(service, (state) => state.status === 'enabled');
  expect(fake.adapter.scheduleDailyNudge).toHaveBeenCalledTimes(1);
});

test('foreground and transaction invalidations are serialized and cleanup is idempotent', async () => {
  const fake = fakeAdapter({ status: 'allowed', quiet: false });
  const { service, lifecycle } = createService(jest.fn(async () => true), fake);
  const stop = service.start(lifecycle.bindings);
  lifecycle.emitAppState('background');
  lifecycle.emitAppState('active');
  lifecycle.emitLedger();
  await waitForState(service, (state) => state.status === 'enabled');

  stop();
  stop();
  expect(lifecycle.removeLedger).toHaveBeenCalledTimes(1);
  expect(lifecycle.removeAppState).toHaveBeenCalledTimes(1);
  expect(fake.adapter.scheduleDailyNudge).toHaveBeenCalledTimes(1);
});

test('a replacement worker reuses the same queue while an old OS call is still pending', async () => {
  let resolveSchedule: (identifier: string) => void = () => undefined;
  const pendingSchedule = new Promise<string>((resolve) => {
    resolveSchedule = resolve;
  });
  const fake = fakeAdapter({ status: 'allowed', quiet: false });
  fake.setScheduleImplementation(async (schedule) => {
    fake.calls.push('schedule-started');
    const identifier = await pendingSchedule;
    fake.requests.push(scheduledRequest(schedule));
    return identifier;
  });
  const { service, lifecycle } = createService(jest.fn(async () => true), fake);
  const stop = service.start(lifecycle.bindings);
  await waitForState(service, (state) => fake.calls.includes('schedule-started'));
  stop();

  service.start(lifecycle.bindings);
  resolveSchedule(DRAFT_NUDGE_SCHEDULE.identifier);
  await waitForState(service, (state) => state.status === 'enabled');

  expect(fake.adapter.scheduleDailyNudge).toHaveBeenCalledTimes(1);
  expect(fake.adapter.listScheduled).toHaveBeenCalled();
});
