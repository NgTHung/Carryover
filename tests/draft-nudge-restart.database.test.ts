import { strict as assert } from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createAsyncAtomicRunner } from '../src/data/atomic';
import { createCapturedDraftData } from '../src/data/captured-drafts';
import { createCategoryData } from '../src/data/categories';
import { createDraftInboxData } from '../src/data/draft-inbox';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createManualTransactionData } from '../src/data/manual-transactions';
import { createTransactionData } from '../src/data/transactions';
import {
  createDraftNudgeService,
  type DraftNudgeAppState,
  type DraftNudgeService,
  type DraftNudgeServiceBindings,
} from '../src/notifications/draft-nudge-service';
import {
  DRAFT_NUDGE_IDENTIFIER,
  DRAFT_NUDGE_SCHEDULE,
} from '../src/notifications/draft-nudge-policy';
import {
  bankId,
  completionNow,
  waitFor,
} from './support/draft-completion-fixture';
import {
  createFakeDraftNudgeAdapter,
  scheduledDraftNudgeRequest,
} from './support/draft-nudge-adapter';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const draftId = '123e4567-e89b-42d3-a456-426614174020';

function appState(): DraftNudgeAppState {
  return {
    currentState: 'active',
    addEventListener: () => ({ remove: () => undefined }),
  };
}

function bindings(
  notifier: ReturnType<typeof createLedgerChangeNotifier>
): DraftNudgeServiceBindings {
  return {
    subscribeToLedger: (listener) =>
      notifier.subscribe((change) => {
        if (change.table === 'transactions') listener();
      }),
    appState: appState(),
  };
}

async function waitForState(
  service: DraftNudgeService,
  predicate: (state: ReturnType<DraftNudgeService['getState']>) => boolean,
  message: string
): Promise<void> {
  await waitFor(() => predicate(service.getState()), message);
}

test('reopens a file-backed ledger and repairs valid, duplicate, stale, and missing OS schedules', async () => {
  const root = mkdtempSync(join(tmpdir(), 'carryover-draft-nudge-'));
  const databasePath = join(root, 'carryover.db');
  let database: ReturnType<typeof openMigratedDatabase> | undefined;
  let reopened: DatabaseSync | undefined;
  let firstStop: (() => void) | undefined;
  let secondStop: (() => void) | undefined;
  let firstService: DraftNudgeService | undefined;
  let secondService: DraftNudgeService | undefined;

  try {
    database = openMigratedDatabase(databasePath);
    const firstProxy = createProxyDatabase(database);
    const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
    const categories = createCategoryData(firstProxy);
    const capturedDrafts = createCapturedDraftData(firstProxy, notifier, {
      runAtomic: createAsyncAtomicRunner(firstProxy),
      now: () => completionNow,
    });
    const manual = createManualTransactionData(firstProxy, categories, notifier, {
      runAtomic: createAsyncAtomicRunner(firstProxy),
      now: () => completionNow,
    });
    await capturedDrafts.createCapturedDraft({
      draftId,
      photoKey: `photos/v1/${draftId}.jpg`,
      amount: null,
      occurredAt: completionNow,
    });

    const stale = scheduledDraftNudgeRequest({
      ...DRAFT_NUDGE_SCHEDULE,
      body: 'Old reminder copy',
    }, 'stale-owned-request');
    const duplicate = scheduledDraftNudgeRequest(DRAFT_NUDGE_SCHEDULE, 'duplicate-owned-request');
    const unrelated = scheduledDraftNudgeRequest(DRAFT_NUDGE_SCHEDULE, 'other-feature-request');
    unrelated.content = { ...unrelated.content, data: { kind: 'other-feature' } };
    const fake = createFakeDraftNudgeAdapter(
      { status: 'allowed', quiet: false },
      [scheduledDraftNudgeRequest(), duplicate, stale, unrelated]
    );
    const inbox = createDraftInboxData(firstProxy);
    firstService = createDraftNudgeService({
      readHasUnknownDrafts: () => inbox.hasUnknownDrafts(),
      adapter: fake.adapter,
    });
    firstStop = firstService.start(bindings(notifier));
    await waitForState(firstService, (state) => state.status === 'enabled', 'Duplicate schedule was not repaired');
    assert.deepEqual(
      fake.requests.map(({ identifier }) => identifier).sort(),
      ['other-feature-request', DRAFT_NUDGE_IDENTIFIER].sort()
    );

    const canonicalIndex = fake.requests.findIndex(
      ({ identifier }) => identifier === DRAFT_NUDGE_IDENTIFIER
    );
    if (canonicalIndex < 0) throw new Error('Expected a canonical request after duplicate repair');
    fake.requests.splice(canonicalIndex, 1);
    firstStop();
    firstStop = undefined;

    const schedulesBeforeRestart = fake.calls.filter((call) => call === 'schedule').length;
    secondStop = firstService.start(bindings(notifier));
    await waitFor(
      () => fake.calls.filter((call) => call === 'schedule').length > schedulesBeforeRestart,
      'A missing schedule was not recreated'
    );
    await waitForState(firstService, (state) => state.status === 'enabled', 'Recreated schedule was not verified');
    assert.equal(
      fake.requests.filter(({ identifier }) => identifier === DRAFT_NUDGE_IDENTIFIER).length,
      1
    );

    secondStop();
    secondStop = undefined;
    await manual.editTransaction({
      transactionId: draftId,
      changes: { amount: 45_001 },
    });
    assert.equal((await inbox.hasUnknownDrafts()), false);
    database.close();
    database = undefined;

    reopened = new DatabaseSync(databasePath);
    reopened.exec('PRAGMA foreign_keys = ON;');
    const reopenedProxy = createProxyDatabase(reopened);
    const reopenedNotifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
    const reopenedInbox = createDraftInboxData(reopenedProxy);
    secondService = createDraftNudgeService({
      readHasUnknownDrafts: () => reopenedInbox.hasUnknownDrafts(),
      adapter: fake.adapter,
    });
    const reopenedStop = secondService.start(bindings(reopenedNotifier));
    await waitForState(secondService, (state) => state.status === 'idle', 'Restart did not cancel the stale reminder');
    assert.equal(
      fake.requests.filter(({ identifier }) => identifier === DRAFT_NUDGE_IDENTIFIER).length,
      0
    );
    assert.deepEqual(fake.requests.map(({ identifier }) => identifier), ['other-feature-request']);

    const persisted = await createTransactionData(
      reopenedProxy,
      createCategoryData(reopenedProxy)
    ).readTransaction(draftId);
    assert.equal(persisted?.status, 'draft');
    assert.equal(persisted?.amount, 45_001);
    assert.equal(persisted?.accountId, bankId(reopened));
    reopenedStop();
  } finally {
    firstStop?.();
    secondStop?.();
    firstService?.dispose();
    secondService?.dispose();
    database?.close();
    reopened?.close();
    rmSync(root, { recursive: true, force: true });
  }
});
