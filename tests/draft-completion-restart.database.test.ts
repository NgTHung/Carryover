import { strict as assert } from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createAsyncAtomicRunner } from '../src/data/atomic';
import { createCapturedDraftData } from '../src/data/captured-drafts';
import { createCategoryData } from '../src/data/categories';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createManualTransactionData } from '../src/data/manual-transactions';
import { createTransactionData } from '../src/data/transactions';
import {
  bankId,
  completionNow,
  completionPhotoKey,
  createDraftCompletionHarness,
  readySnapshot,
  spendLeaf,
} from './support/draft-completion-fixture';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const draftId = '123e4567-e89b-42d3-a456-426614174010';

test('a completed captured draft and its snapshot survive closing and reopening the database', async () => {
  const root = mkdtempSync(join(tmpdir(), 'carryover-completion-restart-'));
  const databasePath = join(root, 'carryover.db');
  let firstDatabase: DatabaseSync | undefined;
  let reopenedDatabase: DatabaseSync | undefined;

  try {
    firstDatabase = openMigratedDatabase(databasePath);
    const firstProxy = createProxyDatabase(firstDatabase);
    const silentNotifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
    const categories = createCategoryData(firstProxy, silentNotifier);
    const runAtomic = createAsyncAtomicRunner(firstProxy);
    const capturedDrafts = createCapturedDraftData(firstProxy, silentNotifier, {
      runAtomic,
      now: () => completionNow,
    });
    const manual = createManualTransactionData(firstProxy, categories, silentNotifier, {
      runAtomic,
      now: () => completionNow,
    });

    const captured = await capturedDrafts.createCapturedDraft({
      draftId,
      photoKey: completionPhotoKey,
      amount: null,
      occurredAt: completionNow,
    });
    const completed = await manual.completeDraft({
      transactionId: captured.transaction.id,
      amount: '45001',
      categoryId: spendLeaf(firstDatabase),
      changes: { quality: 'regret', note: 'Restarted receipt' },
    });

    assert.equal(completed.id, draftId);
    assert.equal(completed.status, 'complete');
    assert.equal(completed.amount, 45_001);
    assert.equal(completed.photoKey, completionPhotoKey);
    assert.equal(completed.quality, 'regret');
    assert.equal(completed.note, 'Restarted receipt');

    firstDatabase.close();
    firstDatabase = undefined;

    reopenedDatabase = new DatabaseSync(databasePath);
    reopenedDatabase.exec('PRAGMA foreign_keys = ON;');
    const reopenedProxy = createProxyDatabase(reopenedDatabase);
    const transactions = createTransactionData(
      reopenedProxy,
      createCategoryData(reopenedProxy)
    );
    const persisted = await transactions.readTransaction(draftId);

    assert.equal(persisted?.id, draftId);
    assert.equal(persisted?.status, 'complete');
    assert.equal(persisted?.amount, 45_001);
    assert.equal(persisted?.photoKey, completionPhotoKey);
    assert.equal(persisted?.quality, 'regret');
    assert.equal(persisted?.note, 'Restarted receipt');
    assert.equal(persisted?.accountId, bankId(reopenedDatabase));
    assert.equal(persisted?.categoryId, spendLeaf(reopenedDatabase));
    assert.equal(persisted?.occurredAt.getTime(), completionNow.getTime());
    assert.deepEqual(persisted?.payer, { kind: 'you' });

    const harness = createDraftCompletionHarness(reopenedDatabase);
    await harness.publisher.refresh();
    assert.equal(harness.written.length, 1);
    assert.equal(readySnapshot(harness.publisher).unloggedDrafts, 0);
    assert.equal(readySnapshot(harness.publisher).spentThisMonth, 45_001);
  } finally {
    firstDatabase?.close();
    reopenedDatabase?.close();
    rmSync(root, { recursive: true, force: true });
  }
});
