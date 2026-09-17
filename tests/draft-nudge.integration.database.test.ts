import { strict as assert } from 'node:assert';

import { createAsyncAtomicRunner } from '../src/data/atomic';
import { createCapturedDraftData } from '../src/data/captured-drafts';
import { createDraftInboxData } from '../src/data/draft-inbox';
import { createManualTransactionData } from '../src/data/manual-transactions';
import { createDraftNudgeService, type DraftNudgeAppState, type DraftNudgeService } from '../src/notifications/draft-nudge-service';
import { startSnapshotPublisher } from '../src/budget/snapshot-publisher';
import { DRAFT_NUDGE_IDENTIFIER } from '../src/notifications/draft-nudge-policy';
import {
  bankId,
  completionNow,
  completionPhotoKey,
  createDraftCompletionHarness,
  readySnapshot,
  spendLeaf,
  waitFor,
} from './support/draft-completion-fixture';
import {
  createFakeDraftNudgeAdapter,
  type FakeDraftNudgeAdapter,
} from './support/draft-nudge-adapter';
import { openMigratedDatabase } from './support/sqlite-proxy';

const partialDraftId = '123e4567-e89b-42d3-a456-426614174010';
const deletedDraftId = '123e4567-e89b-42d3-a456-426614174011';
const completedDraftId = '123e4567-e89b-42d3-a456-426614174012';
const knownDraftId = '123e4567-e89b-42d3-a456-426614174013';
const clearedDraftId = '123e4567-e89b-42d3-a456-426614174014';
const failureDraftId = '123e4567-e89b-42d3-a456-426614174015';
const snapshotFailureDraftId = '123e4567-e89b-42d3-a456-426614174016';

function appState(): DraftNudgeAppState {
  return {
    currentState: 'active',
    addEventListener: () => ({ remove: () => undefined }),
  };
}

function startNudge(
  harness: ReturnType<typeof createDraftCompletionHarness>,
  fake: FakeDraftNudgeAdapter
): { service: DraftNudgeService; stop: () => void } {
  const inbox = createDraftInboxData(harness.proxy);
  const service = createDraftNudgeService({
    readHasUnknownDrafts: () => inbox.hasUnknownDrafts(),
    adapter: fake.adapter,
  });
  const stop = service.start({
    subscribeToLedger: (listener) =>
      harness.notifier.subscribe((change) => {
        if (change.table === 'transactions') listener();
      }),
    appState: appState(),
  });
  return { service, stop };
}

async function waitForState(
  service: DraftNudgeService,
  predicate: (state: ReturnType<DraftNudgeService['getState']>) => boolean,
  message: string
): Promise<void> {
  await waitFor(() => predicate(service.getState()), message);
}

function createCapturedDrafts(
  harness: ReturnType<typeof createDraftCompletionHarness>
) {
  return createCapturedDraftData(harness.proxy, harness.notifier, {
    runAtomic: createAsyncAtomicRunner(harness.proxy),
    now: () => completionNow,
  });
}

async function createDraft(
  capturedDrafts: ReturnType<typeof createCapturedDrafts>,
  draftId: string,
  amount: string | number | null,
  occurredAt = completionNow
): Promise<void> {
  await capturedDrafts.createCapturedDraft({
    draftId,
    photoKey: `photos/v1/${draftId}.jpg`,
    amount,
    occurredAt,
  });
}

function transactionCount(
  database: ReturnType<typeof openMigratedDatabase>
): number {
  return (
    database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }
  ).count;
}

function ownedRequestCount(fake: FakeDraftNudgeAdapter): number {
  return fake.requests.filter((request) =>
    request.identifier === DRAFT_NUDGE_IDENTIFIER
  ).length;
}

async function startPublisher(
  harness: ReturnType<typeof createDraftCompletionHarness>
): Promise<() => void> {
  const stop = startSnapshotPublisher(harness.publisher, harness.notifier);
  await waitFor(
    () => harness.written.length === 1 && harness.publisher.store.getState().status === 'ready',
    'Initial budget snapshot did not publish'
  );
  return stop;
}

test('real ledger mutations drive one reminder across periods while snapshots keep exact amounts', async () => {
  const database = openMigratedDatabase();
  let stopPublisher: (() => void) | undefined;
  let stopNudge: (() => void) | undefined;
  try {
    database.prepare("UPDATE accounts SET opening_balance = 1000000 WHERE name = 'Bank'").run();
    const harness = createDraftCompletionHarness(database);
    const capturedDrafts = createCapturedDrafts(harness);
    await createDraft(capturedDrafts, partialDraftId, null);
    await createDraft(capturedDrafts, deletedDraftId, null, new Date(2026, 7, 20, 10));
    await createDraft(capturedDrafts, completedDraftId, null);
    await createDraft(capturedDrafts, knownDraftId, '12000');

    stopPublisher = await startPublisher(harness);
    const fake = createFakeDraftNudgeAdapter();
    const nudge = startNudge(harness, fake);
    stopNudge = () => {
      nudge.stop();
      nudge.service.dispose();
    };
    await waitForState(nudge.service, (state) => state.status === 'enabled', 'Initial reminder was not enabled');
    assert.equal(ownedRequestCount(fake), 1);

    const before = readySnapshot(harness.publisher);
    const initialWrites = harness.written.length;
    const partial = await harness.manual.editTransaction({
      transactionId: partialDraftId,
      changes: { amount: 45_001 },
    });
    assert.equal(partial.status, 'draft');
    assert.equal(partial.amount, 45_001);
    await waitForState(nudge.service, (state) => state.status === 'enabled', 'A remaining unknown lost its reminder');
    await waitFor(
      () =>
        harness.written.length > initialWrites &&
        harness.publisher.store.getState().status === 'ready' &&
        readySnapshot(harness.publisher).spentThisMonth === before.spentThisMonth + 45_001,
      'Partial amount did not publish as an exact integer'
    );

    await harness.manual.softDeleteTransaction(deletedDraftId);
    await waitForState(nudge.service, (state) => state.status === 'enabled', 'Deletion removed a reminder for another unknown');

    const completed = await harness.manual.completeDraft({
      transactionId: completedDraftId,
      amount: 45_001,
      categoryId: spendLeaf(database),
    });
    assert.equal(completed.status, 'complete');
    assert.equal(completed.amount, 45_001);
    await waitForState(nudge.service, (state) => state.status === 'idle', 'The last unknown did not cancel the reminder');
    assert.equal(ownedRequestCount(fake), 0);

    const activeDrafts = await createDraftInboxData(harness.proxy).readActiveDrafts();
    assert.equal(activeDrafts.length, 2);
    assert.equal(activeDrafts.some(({ id }) => id === partialDraftId), true);
    assert.equal(activeDrafts.some(({ id }) => id === knownDraftId), true);
    await waitFor(
      () =>
        harness.publisher.store.getState().status === 'ready' &&
        readySnapshot(harness.publisher).spentThisMonth === 12_000 + 90_002,
      'Completion snapshot did not publish the exact total'
    );
    const afterCompletion = readySnapshot(harness.publisher);
    assert.equal(afterCompletion.spentThisMonth, before.spentThisMonth + 90_002);
    assert.equal(afterCompletion.balanceTotal, before.balanceTotal - 90_002);

    await createDraft(capturedDrafts, clearedDraftId, null);
    await waitForState(nudge.service, (state) => state.status === 'enabled', 'A new unknown did not restore the reminder');
    await harness.manual.editTransaction({
      transactionId: clearedDraftId,
      changes: { amount: 45_001 },
    });
    await waitForState(nudge.service, (state) => state.status === 'idle', 'Saving an amount did not cancel the last reminder');
    assert.equal(ownedRequestCount(fake), 0);

    await harness.manual.editTransaction({
      transactionId: clearedDraftId,
      changes: { amount: null },
    });
    await waitForState(nudge.service, (state) => state.status === 'enabled', 'Clearing an amount did not restore eligibility');
    await assert.rejects(
      harness.manual.completeDraft({
        transactionId: clearedDraftId,
        amount: 'not-an-integer',
        categoryId: spendLeaf(database),
      })
    );
    const rolledBack = await harness.transactions.readTransaction(clearedDraftId);
    assert.equal(rolledBack?.amount, null);
    assert.equal(transactionCount(database), 5);

    await harness.manual.softDeleteTransaction(clearedDraftId);
    await waitForState(nudge.service, (state) => state.status === 'idle', 'Deletion did not cancel the restored reminder');
    assert.equal(ownedRequestCount(fake), 0);
  } finally {
    stopNudge?.();
    stopPublisher?.();
    database.close();
  }
});

test('notification and snapshot failures do not roll back committed capture or manual writes', async () => {
  const database = openMigratedDatabase();
  let stopPublisher: (() => void) | undefined;
  let stopNudge: (() => void) | undefined;
  try {
    const harness = createDraftCompletionHarness(database);
    const capturedDrafts = createCapturedDrafts(harness);
    stopPublisher = await startPublisher(harness);
    const fake = createFakeDraftNudgeAdapter();
    fake.setScheduleFailure(true);
    const nudge = startNudge(harness, fake);
    stopNudge = () => {
      nudge.stop();
      nudge.service.dispose();
    };

    await createDraft(capturedDrafts, failureDraftId, null);
    assert.equal(transactionCount(database), 1);
    const committedAfterScheduleFailure = await harness.transactions.readTransaction(failureDraftId);
    assert.equal(committedAfterScheduleFailure?.amount, null);
    await waitForState(nudge.service, (state) => state.status === 'error', 'Schedule failure was not surfaced');
    assert.equal(ownedRequestCount(fake), 0);

    fake.setScheduleFailure(false);
    await nudge.service.retry();
    await waitForState(nudge.service, (state) => state.status === 'enabled', 'Schedule retry did not recover');
    assert.equal(ownedRequestCount(fake), 1);

    fake.setCancellationFailure(true);
    const edited = await harness.manual.editTransaction({
      transactionId: failureDraftId,
      changes: { amount: 45_001 },
    });
    assert.equal(edited.amount, 45_001);
    await waitForState(nudge.service, (state) => state.status === 'error', 'Cancellation failure was not surfaced');
    assert.equal((await harness.transactions.readTransaction(failureDraftId))?.amount, 45_001);
    assert.equal(ownedRequestCount(fake), 1);

    fake.setCancellationFailure(false);
    await nudge.service.retry();
    await waitForState(nudge.service, (state) => state.status === 'idle', 'Cancellation retry did not recover');
    assert.equal(ownedRequestCount(fake), 0);

    harness.setWriteFailure(true);
    await createDraft(capturedDrafts, snapshotFailureDraftId, null);
    await waitForState(nudge.service, (state) => state.status === 'enabled', 'Reminder reconciliation waited on snapshot storage');
    await waitFor(
      () => harness.publisher.store.getState().status === 'error',
      'Snapshot failure was not exposed'
    );
    assert.equal(transactionCount(database), 2);
    assert.equal((await harness.transactions.readTransaction(snapshotFailureDraftId))?.amount, null);

    harness.setWriteFailure(false);
    await harness.publisher.retry();
    assert.equal(harness.publisher.store.getState().status, 'ready');
    assert.equal(ownedRequestCount(fake), 1);
  } finally {
    stopNudge?.();
    stopPublisher?.();
    database.close();
  }
});
