import { strict as assert } from 'node:assert';

import {
  millisecondsUntilNextLocalDay,
  startSnapshotFreshness,
  type SnapshotAppState,
} from '../src/budget/snapshot-freshness';

function deferredFlush(): Promise<void> {
  return Promise.resolve().then(() => undefined);
}

test('computes the next local day boundary', () => {
  assert.equal(
    millisecondsUntilNextLocalDay(new Date(2026, 8, 10, 23, 59, 59, 250)),
    750
  );
});

test('refreshes after foreground entry and at local midnight', async () => {
  let appStateListener: ((state: string) => void) | undefined;
  let timerCallback: (() => void) | undefined;
  let timerDelay = 0;
  let removed = false;
  let cleared = 0;
  let refreshes = 0;
  const timerHandle = setTimeout(() => undefined, 60_000);
  clearTimeout(timerHandle);
  const appState: SnapshotAppState = {
    currentState: 'active',
    addEventListener(_event, listener) {
      appStateListener = listener;
      return { remove: () => { removed = true; } };
    },
  };

  const stop = startSnapshotFreshness(
    {
      refresh: async () => {
        refreshes += 1;
      },
    },
    appState,
    {
      now: () => new Date(2026, 8, 10, 23, 59, 59, 250),
      setTimer: (callback, delay) => {
        timerCallback = callback;
        timerDelay = delay;
        return timerHandle;
      },
      clearTimer: () => {
        cleared += 1;
      },
    }
  );

  assert.equal(timerDelay, 750);
  appStateListener?.('background');
  appStateListener?.('active');
  await deferredFlush();
  assert.equal(refreshes, 1);

  timerCallback?.();
  await deferredFlush();
  assert.equal(refreshes, 2);

  stop();
  assert.equal(removed, true);
  assert.equal(cleared, 3);
});

test('keeps a failed freshness refresh observable without rejecting the timer', async () => {
  let appStateListener: ((state: string) => void) | undefined;
  const appState: SnapshotAppState = {
    currentState: 'background',
    addEventListener(_event, listener) {
      appStateListener = listener;
      return { remove: () => undefined };
    },
  };
  const stop = startSnapshotFreshness(
    { refresh: async () => { throw new Error('shared storage unavailable'); } },
    appState
  );

  appStateListener?.('active');
  await deferredFlush();
  stop();
});
