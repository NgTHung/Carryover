import { strict as assert } from 'node:assert';

import { readBudgetInput } from '../src/budget/snapshot-source';
import type { BudgetSnapshot } from '../src/budget/snapshot';
import {
  createSnapshotPublisher,
  startSnapshotPublisher,
} from '../src/budget/snapshot-publisher';
import { createSnapshotStore } from '../src/budget/snapshot-store';
import { createAccountData } from '../src/data/accounts';
import { createCapturedDraftData } from '../src/data/captured-drafts';
import { createCategoryData } from '../src/data/categories';
import { createCommitmentData } from '../src/data/commitments';
import { createAsyncAtomicRunner } from '../src/data/atomic';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createMonthConfigData } from '../src/data/month-config';
import { createPeriodPreparationData } from '../src/data/period-preparation';
import { createShareData } from '../src/data/shares';
import { createTransactionData } from '../src/data/transactions';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const now = new Date(2026, 8, 15, 12, 30);
const firstDraftId = '123e4567-e89b-42d3-a456-426614174000';
const secondDraftId = '123e4567-e89b-42d3-a456-426614174002';
const firstPhotoKey = 'photos/v1/123e4567-e89b-42d3-a456-426614174001.jpg';
const secondPhotoKey = 'photos/v1/123e4567-e89b-42d3-a456-426614174003.jpg';

async function waitFor(condition: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (condition()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error(message);
}

function readySnapshot(
  publisher: ReturnType<typeof createSnapshotPublisher>
): BudgetSnapshot {
  const state = publisher.store.getState();
  if (state.status !== 'ready') {
    throw new Error(`Expected a ready snapshot, received ${state.status}`);
  }
  return state.snapshot;
}

function transactionCount(database: ReturnType<typeof openMigratedDatabase>): number {
  return (
    database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }
  ).count;
}

function createHarness(database: ReturnType<typeof openMigratedDatabase>) {
  const proxy = createProxyDatabase(database);
  const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
  const silentNotifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
  const preparation = createPeriodPreparationData(proxy, {
    now: () => now,
    changeNotifier: silentNotifier,
  });
  const monthConfig = createMonthConfigData(proxy, silentNotifier);
  const reads = {
    accounts: createAccountData(proxy, silentNotifier),
    commitments: createCommitmentData(proxy, silentNotifier),
    monthConfig,
    shares: createShareData(proxy),
    transactions: createTransactionData(
      proxy,
      createCategoryData(proxy, silentNotifier),
      silentNotifier
    ),
  };
  const written: BudgetSnapshot[] = [];
  let failWrites = false;
  const publisher = createSnapshotPublisher({
    store: createSnapshotStore(),
    now: () => now,
    readInput: async (at) => {
      await preparation.prepareCurrentPeriod(at);
      return readBudgetInput(reads, at);
    },
    writer(snapshot) {
      if (failWrites) throw new Error('shared storage unavailable');
      written.push(snapshot);
    },
  });
  const capturedDrafts = createCapturedDraftData(proxy, notifier, {
    runAtomic: createAsyncAtomicRunner(proxy),
    now: () => now,
  });
  return {
    capturedDrafts,
    monthConfig,
    notifier,
    publisher,
    written,
    setWriteFailure(value: boolean) {
      failWrites = value;
    },
  };
}

function captureInput(
  draftId: string,
  photoKey: string,
  amount: string | number | null
) {
  return {
    draftId,
    photoKey,
    amount,
    occurredAt: now,
  };
}

async function start(harness: ReturnType<typeof createHarness>): Promise<() => void> {
  const stop = startSnapshotPublisher(harness.publisher, harness.notifier);
  await waitFor(
    () => harness.written.length === 1 && harness.publisher.store.getState().status === 'ready',
    'Initial snapshot did not publish'
  );
  return stop;
}

test('an unknown capture publishes one unknown without inventing spending', async () => {
  const database = openMigratedDatabase();
  try {
    database.prepare("UPDATE accounts SET opening_balance = 1000000 WHERE name = 'Bank'").run();
    const harness = createHarness(database);
    const stop = await start(harness);
    const before = readySnapshot(harness.publisher);

    const result = await harness.capturedDrafts.createCapturedDraft(
      captureInput(firstDraftId, firstPhotoKey, ' ')
    );
    assert.equal(result.transaction.amount, null);
    await waitFor(() => harness.written.length === 2, 'Unknown capture did not publish');
    const after = readySnapshot(harness.publisher);

    assert.equal(after.unloggedDrafts, before.unloggedDrafts + 1);
    assert.equal(after.spentThisMonth, before.spentThisMonth);
    assert.equal(after.balanceTotal, before.balanceTotal);
    assert.equal(harness.written[1], after);

    const replay = await harness.capturedDrafts.createCapturedDraft(
      captureInput(firstDraftId, firstPhotoKey, ' ')
    );
    assert.equal(replay.status, 'existing');
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(harness.written.length, 2);
    stop();
  } finally {
    database.close();
  }
});

test('a known capture changes spending by its exact integer amount', async () => {
  const database = openMigratedDatabase();
  try {
    database.prepare("UPDATE accounts SET opening_balance = 1000000 WHERE name = 'Bank'").run();
    const harness = createHarness(database);
    const stop = await start(harness);
    const before = readySnapshot(harness.publisher);

    const result = await harness.capturedDrafts.createCapturedDraft(
      captureInput(secondDraftId, secondPhotoKey, '45001')
    );
    assert.equal(result.transaction.amount, 45_001);
    await waitFor(() => harness.written.length === 2, 'Known capture did not publish');
    const after = readySnapshot(harness.publisher);

    assert.equal(after.spentThisMonth, before.spentThisMonth + 45_001);
    assert.equal(after.balanceTotal, before.balanceTotal - 45_001);
    assert.equal(after.unloggedDrafts, before.unloggedDrafts);
    stop();
  } finally {
    database.close();
  }
});

test('a snapshot write failure leaves one durable draft and retry republishes it', async () => {
  const database = openMigratedDatabase();
  try {
    const harness = createHarness(database);
    const stop = await start(harness);
    harness.setWriteFailure(true);

    await harness.capturedDrafts.createCapturedDraft(
      captureInput(firstDraftId, firstPhotoKey, null)
    );
    await waitFor(
      () => harness.publisher.store.getState().status === 'error',
      'Snapshot failure did not reach the app store'
    );
    assert.equal(transactionCount(database), 1);
    assert.equal(harness.written.length, 1);

    harness.setWriteFailure(false);
    await harness.publisher.retry();
    assert.equal(transactionCount(database), 1);
    assert.equal(harness.written.length, 2);
    assert.equal(readySnapshot(harness.publisher).unloggedDrafts, 1);
    stop();
  } finally {
    database.close();
  }
});
