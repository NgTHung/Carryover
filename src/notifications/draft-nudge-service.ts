/**
 * Serializes reminder reconciliation around two independent sources of truth:
 * SQLite decides whether an unknown exists, and the OS owns pending requests.
 *
 * A ledger commit never waits for this service. If an OS call is uncertain or
 * a process dies between the two systems, the next inspection repairs the
 * durable reminder without writing the ledger again.
 */
import {
  calculateDraftNudgePlan,
  isMatchingDraftNudgeRequest,
  isOwnedDraftNudgeData,
} from './draft-nudge-policy';
import type {
  DraftNudgeAdapter,
  DraftNudgeEligibility,
  DraftNudgePermission,
  DraftNudgeResponse,
  DraftNudgeResponseListener,
  DraftNudgeServiceState,
  DraftNudgeScheduledRequest,
} from './draft-nudge-contract';

export type DraftNudgeAppState = {
  currentState: string | null;
  addEventListener(
    event: 'change',
    listener: (state: string) => void
  ): { remove(): void };
};

export type DraftNudgeServiceBindings = {
  subscribeToLedger: (listener: () => void) => () => void;
  appState: DraftNudgeAppState;
};

export type DraftNudgeServiceOptions = {
  readHasUnknownDrafts: () => Promise<boolean>;
  adapter: DraftNudgeAdapter;
  maxDrainAttempts?: number;
};

export type DraftNudgeService = {
  getState: () => DraftNudgeServiceState;
  subscribe: (listener: (state: DraftNudgeServiceState) => void) => () => void;
  start: (bindings: DraftNudgeServiceBindings) => () => void;
  reconcile: () => Promise<void>;
  retry: () => Promise<void>;
  requestPermission: () => Promise<void>;
  subscribeToResponses: (listener: DraftNudgeResponseListener) => () => void;
  readLastResponse: () => DraftNudgeResponse | null;
  clearLastResponse: () => void;
  dispose: () => void;
};

type ApplyResult = { stale: boolean };
type DraftNudgeServiceOperation =
  | 'startup'
  | 'ledger-change'
  | 'foreground'
  | 'retry'
  | 'permission';

const DEFAULT_MAX_DRAIN_ATTEMPTS = 8;

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function eligibilityFor(hasUnknownDrafts: boolean): DraftNudgeEligibility {
  return hasUnknownDrafts ? { status: 'has-unknowns' } : { status: 'none' };
}

function ownedRequests(
  requests: DraftNudgeScheduledRequest[]
): DraftNudgeScheduledRequest[] {
  return requests.filter((request) =>
    isOwnedDraftNudgeData(request.identifier, request.content.data)
  );
}

function errorText(error: unknown): string {
  return asError(error).message;
}

export function createDraftNudgeService(
  options: DraftNudgeServiceOptions
): DraftNudgeService {
  const listeners = new Set<(state: DraftNudgeServiceState) => void>();
  const maxDrainAttempts = options.maxDrainAttempts ?? DEFAULT_MAX_DRAIN_ATTEMPTS;
  let state: DraftNudgeServiceState = {
    status: 'checking',
    eligibility: { status: 'unknown' },
    operation: 'startup',
  };
  let generation = 0;
  let dirty = false;
  let started = false;
  let disposed = false;
  let lifecycleCount = 0;
  let drainQueued = false;
  let operationQueue: Promise<void> = Promise.resolve();
  let unsubscribeLedger: (() => void) | undefined;
  let appStateSubscription: { remove(): void } | undefined;

  function publish(next: DraftNudgeServiceState): void {
    if (disposed) return;
    state = next;
    for (const listener of listeners) {
      try {
        listener(next);
      } catch (error: unknown) {
        console.error('Daily reminder state listener failed', error);
      }
    }
  }

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = operationQueue.then(operation);
    operationQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  function markChecking(operation: DraftNudgeServiceOperation): void {
    publish({
      status: 'checking',
      eligibility: state.eligibility,
      operation,
    });
  }

  function markError(
    eligibility: DraftNudgeEligibility,
    operation: Extract<DraftNudgeServiceState, { status: 'error' }>['operation'],
    message: string
  ): void {
    publish({ status: 'error', eligibility, operation, message });
  }

  function scheduleDrain(operation: DraftNudgeServiceOperation): Promise<void> {
    if (!started || disposed) return Promise.resolve();
    if (drainQueued) return operationQueue;
    drainQueued = true;
    return enqueue(async () => {
      drainQueued = false;
      await drainLoop(operation);
    });
  }

  function invalidate(operation: DraftNudgeServiceOperation): Promise<void> {
    if (disposed) return Promise.resolve();
    generation += 1;
    dirty = true;
    return scheduleDrain(operation);
  }

  async function readOwned(): Promise<DraftNudgeScheduledRequest[]> {
    return ownedRequests(await options.adapter.listScheduled());
  }

  async function verifyNoOwned(expectedGeneration: number): Promise<ApplyResult> {
    const remaining = await readOwned();
    if (!started || disposed || generation !== expectedGeneration) return { stale: true };
    if (remaining.length > 0) {
      throw new Error(`${remaining.length} owned reminder request(s) remained after cancellation`);
    }
    return { stale: false };
  }

  async function verifyCanonical(expectedGeneration: number): Promise<ApplyResult> {
    const remaining = await readOwned();
    if (!started || disposed || generation !== expectedGeneration) return { stale: true };
    const only = remaining[0];
    if (remaining.length !== 1 || only === undefined || !isMatchingDraftNudgeRequest(only)) {
      throw new Error('The canonical daily reminder was not the only owned request after scheduling');
    }
    return { stale: false };
  }

  async function cancelRequests(
    requests: DraftNudgeScheduledRequest[],
    expectedGeneration: number
  ): Promise<ApplyResult> {
    const cancelled = new Set<string>();
    for (const request of requests) {
      if (cancelled.has(request.identifier)) continue;
      cancelled.add(request.identifier);
      await options.adapter.cancelScheduled(request.identifier);
      if (!started || disposed || generation !== expectedGeneration) return { stale: true };
    }
    return { stale: false };
  }

  async function applyPlan(
    plan: ReturnType<typeof calculateDraftNudgePlan>,
    expectedGeneration: number
  ): Promise<ApplyResult> {
    const cancellation = await cancelRequests(plan.cancel, expectedGeneration);
    if (cancellation.stale) return cancellation;

    if (plan.action === 'cancel') {
      if (plan.cleanupDelivered) {
        await options.adapter.dismissOwnedDelivered();
        if (!started || disposed || generation !== expectedGeneration) return { stale: true };
      }
      return plan.cancel.length === 0
        ? { stale: false }
        : verifyNoOwned(expectedGeneration);
    }

    if (plan.action === 'keep') {
      return plan.cancel.length === 0
        ? { stale: false }
        : verifyCanonical(expectedGeneration);
    }

    const afterCancellation = await verifyNoOwned(expectedGeneration);
    if (afterCancellation.stale) return afterCancellation;
    const scheduledIdentifier = await options.adapter.scheduleDailyNudge(plan.schedule);
    if (!started || disposed || generation !== expectedGeneration) return { stale: true };
    if (scheduledIdentifier !== plan.schedule.identifier) {
      throw new Error(
        `The daily reminder returned unexpected identifier ${scheduledIdentifier}`
      );
    }
    return verifyCanonical(expectedGeneration);
  }

  async function reconcileOnce(expectedGeneration: number): Promise<void> {
    let hasUnknownDrafts: boolean;
    try {
      hasUnknownDrafts = await options.readHasUnknownDrafts();
    } catch (error: unknown) {
      if (generation === expectedGeneration && started && !disposed) {
        markError({ status: 'unknown' }, 'ledger', `Could not read unknown drafts: ${errorText(error)}`);
      }
      return;
    }
    if (!started || disposed || generation !== expectedGeneration) return;

    const eligibility = eligibilityFor(hasUnknownDrafts);
    let scheduled: DraftNudgeScheduledRequest[];
    try {
      scheduled = await options.adapter.listScheduled();
    } catch (error: unknown) {
      if (generation === expectedGeneration && started && !disposed) {
        markError(eligibility, 'notifications', `Could not inspect daily reminders: ${errorText(error)}`);
      }
      return;
    }
    if (!started || disposed || generation !== expectedGeneration) return;

    let permission: DraftNudgePermission | undefined;
    let permissionFailure: unknown;
    try {
      permission = await options.adapter.inspectPermission();
    } catch (error: unknown) {
      permissionFailure = error;
    }
    if (!started || disposed || generation !== expectedGeneration) return;

    const plan = calculateDraftNudgePlan({
      hasUnknownDrafts,
      permission: permission ?? {
        status: 'unavailable',
        message: errorText(permissionFailure),
      },
      scheduled,
    });
    try {
      const applied = await applyPlan(plan, expectedGeneration);
      if (applied.stale || !started || disposed || generation !== expectedGeneration) return;
    } catch (error: unknown) {
      if (generation === expectedGeneration && started && !disposed) {
        markError(eligibility, 'notifications', `Daily reminder reconciliation failed: ${errorText(error)}`);
      }
      return;
    }

    if (!hasUnknownDrafts) {
      publish({ status: 'idle', eligibility: { status: 'none' }, reason: 'no-unknowns' });
      return;
    }
    if (permissionFailure !== undefined || permission?.status === 'unavailable') {
      publish({
        status: 'unavailable',
        eligibility: { status: 'has-unknowns' },
        operation: 'permission',
        message: permission?.status === 'unavailable'
          ? permission.message
          : `Could not inspect notification permission: ${errorText(permissionFailure)}`,
      });
      return;
    }
    if (permission?.status === 'requestable') {
      publish({ status: 'permission-required', eligibility: { status: 'has-unknowns' }, permission });
      return;
    }
    if (permission?.status === 'denied') {
      publish({ status: 'denied', eligibility: { status: 'has-unknowns' }, permission });
      return;
    }
    if (permission?.status === 'allowed') {
      publish({ status: 'enabled', eligibility: { status: 'has-unknowns' }, permission });
      return;
    }
    markError(eligibility, 'permission', 'Notification permission did not return a usable state.');
  }

  async function drainLoop(operation: DraftNudgeServiceOperation): Promise<void> {
    let attempts = 0;
    while (started && !disposed && dirty) {
      if (attempts >= maxDrainAttempts) {
        dirty = false;
        markError(
          state.eligibility,
          'notifications',
          'Reminder state changed repeatedly. Try again to reconcile it.'
        );
        return;
      }
      dirty = false;
      const expectedGeneration = generation;
      markChecking(operation);
      await reconcileOnce(expectedGeneration);
      attempts += 1;
      if (generation !== expectedGeneration) dirty = true;
    }
  }

  function stopLifecycle(): void {
    started = false;
    generation += 1;
    dirty = false;
    unsubscribeLedger?.();
    unsubscribeLedger = undefined;
    appStateSubscription?.remove();
    appStateSubscription = undefined;
  }

  function start(bindings: DraftNudgeServiceBindings): () => void {
    if (disposed) return () => undefined;
    lifecycleCount += 1;
    if (started) {
      let released = false;
      return () => {
        if (released) return;
        released = true;
        lifecycleCount -= 1;
        if (lifecycleCount === 0) stopLifecycle();
      };
    }

    started = true;
    try {
      options.adapter.configureForegroundPresentation();
    } catch (error: unknown) {
      markError(state.eligibility, 'notifications', `Could not configure foreground reminders: ${errorText(error)}`);
    }
    unsubscribeLedger = bindings.subscribeToLedger(() => {
      void invalidate('ledger-change').catch((error: unknown) => {
        markError(state.eligibility, 'notifications', `Could not reconcile after a ledger change: ${errorText(error)}`);
      });
    });
    let previousState = bindings.appState.currentState;
    appStateSubscription = bindings.appState.addEventListener('change', (nextState) => {
      const becameActive = nextState === 'active' && previousState !== 'active';
      previousState = nextState;
      if (!becameActive) return;
      void invalidate('foreground').catch((error: unknown) => {
        markError(state.eligibility, 'notifications', `Could not reconcile on foreground: ${errorText(error)}`);
      });
    });
    void invalidate('startup').catch((error: unknown) => {
      markError(state.eligibility, 'notifications', `Could not start reminder reconciliation: ${errorText(error)}`);
    });

    let released = false;
    return () => {
      if (released) return;
      released = true;
      lifecycleCount -= 1;
      if (lifecycleCount === 0) stopLifecycle();
    };
  }

  function requestPermission(): Promise<void> {
    if (disposed || !started) return Promise.resolve();
    return enqueue(async () => {
      if (disposed || !started) return;
      const initialGeneration = generation;
      markChecking('permission');
      let hasUnknownDrafts: boolean;
      try {
        hasUnknownDrafts = await options.readHasUnknownDrafts();
      } catch (error: unknown) {
        markError({ status: 'unknown' }, 'ledger', `Could not read unknown drafts: ${errorText(error)}`);
        return;
      }
      if (generation !== initialGeneration) {
        dirty = true;
        await drainLoop('permission');
        return;
      }
      if (!hasUnknownDrafts) {
        generation += 1;
        dirty = true;
        await drainLoop('permission');
        return;
      }

      let current: DraftNudgePermission;
      try {
        current = await options.adapter.inspectPermission();
      } catch (error: unknown) {
        markError({ status: 'has-unknowns' }, 'permission', `Could not inspect notification permission: ${errorText(error)}`);
        return;
      }
      if (generation !== initialGeneration) {
        dirty = true;
        await drainLoop('permission');
        return;
      }
      if (current.status !== 'requestable' || !current.canAskAgain) {
        generation += 1;
        dirty = true;
        await drainLoop('permission');
        return;
      }

      try {
        await options.adapter.requestPermission();
      } catch (error: unknown) {
        markError({ status: 'has-unknowns' }, 'permission', `Could not request notification permission: ${errorText(error)}`);
        return;
      }
      if (disposed || !started) return;
      generation += 1;
      dirty = true;
      await drainLoop('permission');
    });
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    started = false;
    lifecycleCount = 0;
    generation += 1;
    dirty = false;
    unsubscribeLedger?.();
    unsubscribeLedger = undefined;
    appStateSubscription?.remove();
    appStateSubscription = undefined;
    listeners.clear();
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start,
    reconcile: () => invalidate('retry'),
    retry: () => invalidate('retry'),
    requestPermission,
    subscribeToResponses: (listener) => options.adapter.subscribeToResponses(listener),
    readLastResponse: () => options.adapter.readLastResponse(),
    clearLastResponse: () => options.adapter.clearLastResponse(),
    dispose,
  };
}
