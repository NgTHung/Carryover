import { strict as assert } from 'node:assert';

import type { BudgetInput } from '../src/budget/compute-budget';
import {
  createSnapshotPublisher,
  startSnapshotPublisher,
  type SnapshotInputReader,
} from '../src/budget/snapshot-publisher';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import type { BudgetSnapshot } from '../src/budget/snapshot';
import { createSnapshotStore } from '../src/budget/snapshot-store';

function budgetInput(updatedAt = 'input timestamp'): BudgetInput {
  return {
    today: '2026-09-10',
    updatedAt,
    monthConfig: {
      period: '2026-09',
      horizonDate: '2026-09-20',
    },
    accountBalances: [1_000],
    reservedUnpaid: 100,
    transactions: [],
    shares: [],
    owedToYou: 0,
  };
}

function deferred<T>() {
  let resolvePromise: (value: T | PromiseLike<T>) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test('publishes the exact written snapshot only after the writer succeeds', async () => {
  const store = createSnapshotStore();
  const write = deferred<void>();
  let written: BudgetSnapshot | undefined;

  const publisher = createSnapshotPublisher({
    store,
    now: () => new Date('2026-09-10T08:30:00.000Z'),
    readInput: () => budgetInput(),
    writer: (snapshot) => {
      written = snapshot;
      return write.promise;
    },
  });

  const refresh = publisher.refresh();
  await flushPromises();
  assert.deepEqual(store.getState(), { status: 'loading' });

  write.resolve();
  await refresh;

  const readyState = store.getState();
  assert.equal(readyState.status, 'ready');
  if (readyState.status !== 'ready') {
    throw new Error('snapshot should be ready');
  }
  assert.equal(readyState.snapshot, written);
  assert.equal(readyState.snapshot.updatedAt, '2026-09-10T08:30:00.000Z');
});

test('a failed write clears a prior ready snapshot and retry rereads committed input', async () => {
  const store = createSnapshotStore();
  let failWrite = false;
  let reads = 0;
  const reader: SnapshotInputReader = () => {
    reads += 1;
    return budgetInput(`read ${reads}`);
  };
  const publisher = createSnapshotPublisher({
    store,
    readInput: reader,
    writer: () => {
      if (failWrite) {
        throw new Error('shared storage unavailable');
      }
    },
  });

  await publisher.refresh();
  assert.equal(store.getState().status, 'ready');

  failWrite = true;
  const failedRefresh = publisher.refresh();
  assert.deepEqual(store.getState(), { status: 'loading' });
  await assert.rejects(failedRefresh, /shared storage unavailable/);
  assert.deepEqual(store.getState(), {
    status: 'error',
    error: new Error('shared storage unavailable'),
  });

  failWrite = false;
  await publisher.retry();
  assert.equal(reads, 3);
  assert.equal(store.getState().status, 'ready');
});

test('uses the injected clock and the default budget computer', async () => {
  const store = createSnapshotStore();
  const writtenTimestamps: string[] = [];
  const publisher = createSnapshotPublisher({
    store,
    now: () => new Date('2026-09-10T12:00:00.000Z'),
    readInput: (now) => {
      assert.equal(now.toISOString(), '2026-09-10T12:00:00.000Z');
      return budgetInput();
    },
    writer: (snapshot) => {
      writtenTimestamps.push(snapshot.updatedAt);
    },
  });

  await publisher.refresh();

  assert.deepEqual(writtenTimestamps, ['2026-09-10T12:00:00.000Z']);
  const readyState = store.getState();
  assert.equal(readyState.status, 'ready');
  if (readyState.status !== 'ready') {
    throw new Error('snapshot should be ready');
  }
  assert.equal(readyState.snapshot.discretionary, 900);
});

test('queued refreshes write in order and only the newest publishes ready', async () => {
  const store = createSnapshotStore();
  const firstRead = deferred<BudgetInput>();
  let reads = 0;
  const written: number[] = [];
  const publisher = createSnapshotPublisher({
    store,
    now: () => new Date('2026-09-10T00:00:00.000Z'),
    readInput: () => {
      reads += 1;
      return reads === 1
        ? firstRead.promise
        : { ...budgetInput(), accountBalances: [200] };
    },
    writer: (snapshot) => {
      written.push(snapshot.discretionary);
    },
  });

  const first = publisher.refresh();
  await flushPromises();
  const second = publisher.refresh();
  firstRead.resolve(budgetInput('older input'));

  await first;
  await second;

  assert.deepEqual(written, [900, 100]);
  const readyState = store.getState();
  assert.equal(readyState.status, 'ready');
  if (readyState.status !== 'ready') {
    throw new Error('snapshot should be ready');
  }
  assert.equal(readyState.snapshot.updatedAt, '2026-09-10T00:00:00.000Z');
});

test('startup and every committed notification request a publication', async () => {
  const notifier = createLedgerChangeNotifier();
  let writes = 0;
  const publisher = createSnapshotPublisher({
    readInput: () => budgetInput(),
    writer: () => {
      writes += 1;
    },
  });

  const unsubscribe = startSnapshotPublisher(publisher, notifier);
  await publisher.refresh();
  notifier.notify({ table: 'transactions', mutation: 'created' });
  notifier.notify({ table: 'commitments', mutation: 'edited' });
  await publisher.refresh();

  assert.equal(writes, 5);
  unsubscribe();
  notifier.notify({ table: 'accounts', mutation: 'edited' });
  await publisher.refresh();
  assert.equal(writes, 6);
});
