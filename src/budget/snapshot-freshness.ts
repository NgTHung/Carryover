/**
 * Refreshes the snapshot when the date may have changed without a ledger write.
 *
 * Foreground transitions cover time spent suspended. A local-midnight timer
 * covers an app that remains active while per day and runway become stale.
 */
import type { SnapshotPublisher } from './snapshot-publisher';

export type SnapshotAppState = {
  currentState: string | null;
  addEventListener(
    event: 'change',
    listener: (state: string) => void
  ): { remove(): void };
};

type TimerHandle = ReturnType<typeof setTimeout> | number;

export type SnapshotFreshnessOptions = {
  now?: () => Date;
  setTimer?: (callback: () => void, delay: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
};

export function millisecondsUntilNextLocalDay(now: Date): number {
  const nextDay = new Date(now);
  nextDay.setHours(24, 0, 0, 0);
  return Math.max(1, nextDay.getTime() - now.getTime());
}

export function startSnapshotFreshness(
  publisher: Pick<SnapshotPublisher, 'refresh'>,
  appState: SnapshotAppState,
  options: SnapshotFreshnessOptions = {}
): () => void {
  const now = options.now ?? (() => new Date());
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  let currentState = appState.currentState;
  let timer: TimerHandle | undefined;
  let stopped = false;

  const refresh = () => {
    void publisher.refresh().catch(() => {
      // Publication already exposes the failure through the snapshot store.
    });
  };

  const scheduleNextDay = () => {
    if (timer !== undefined) {
      clearTimer(timer);
    }
    timer = setTimer(() => {
      if (stopped) {
        return;
      }
      refresh();
      scheduleNextDay();
    }, millisecondsUntilNextLocalDay(now()));
  };

  const subscription = appState.addEventListener('change', (nextState) => {
    const becameActive = nextState === 'active' && currentState !== 'active';
    currentState = nextState;
    if (becameActive) {
      refresh();
      scheduleNextDay();
    }
  });

  scheduleNextDay();

  return () => {
    stopped = true;
    subscription.remove();
    if (timer !== undefined) {
      clearTimer(timer);
    }
  };
}
