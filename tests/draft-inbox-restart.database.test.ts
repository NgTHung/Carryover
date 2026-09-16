import { strict as assert } from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createCategoryData } from '../src/data/categories';
import { createDraftInboxData } from '../src/data/draft-inbox';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createTransactionData } from '../src/data/transactions';
import {
  bankId,
  completionNow,
  createDraftCompletionHarness,
  readySnapshot,
  spendLeaf,
} from './support/draft-completion-fixture';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const unknownPhotoKey = 'photos/v1/123e4567-e89b-42d3-a456-426614174010.jpg';
const knownPhotoKey = 'photos/v1/123e4567-e89b-42d3-a456-426614174011.jpg';
const deletedPhotoKey = 'photos/v1/123e4567-e89b-42d3-a456-426614174012.jpg';

test('fresh inbox and snapshot services recover active drafts after a database restart', async () => {
  const root = mkdtempSync(join(tmpdir(), 'carryover-draft-inbox-restart-'));
  const databasePath = join(root, 'carryover.db');
  let firstDatabase: DatabaseSync | undefined;
  let reopenedDatabase: DatabaseSync | undefined;

  try {
    firstDatabase = openMigratedDatabase(databasePath);
    const firstProxy = createProxyDatabase(firstDatabase);
    const silentNotifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
    const transactions = createTransactionData(
      firstProxy,
      createCategoryData(firstProxy, silentNotifier),
      silentNotifier
    );
    const bank = bankId(firstDatabase);
    const category = spendLeaf(firstDatabase);

    const unknown = await transactions.createTransaction({
      accountId: bank,
      direction: 'expense',
      status: 'draft',
      amount: null,
      categoryId: null,
      photoKey: unknownPhotoKey,
      occurredAt: new Date(2026, 7, 20, 10),
      quality: null,
      note: null,
      sourceLabel: null,
    });
    const known = await transactions.createTransaction({
      accountId: bank,
      direction: 'income',
      status: 'draft',
      amount: 45_001,
      categoryId: null,
      photoKey: knownPhotoKey,
      occurredAt: completionNow,
      quality: null,
      note: 'Known after restart',
      sourceLabel: 'Salary',
    });
    const complete = await transactions.createTransaction({
      accountId: bank,
      direction: 'expense',
      status: 'complete',
      amount: 12_000,
      categoryId: category,
      photoKey: null,
      occurredAt: completionNow,
      quality: null,
      note: null,
      sourceLabel: null,
    });
    const deleted = await transactions.createTransaction({
      accountId: bank,
      direction: 'expense',
      status: 'draft',
      amount: 9_000,
      categoryId: null,
      photoKey: deletedPhotoKey,
      occurredAt: completionNow,
      quality: null,
      note: null,
      sourceLabel: null,
    });
    await transactions.softDeleteTransaction(deleted.id);

    firstDatabase.close();
    firstDatabase = undefined;

    reopenedDatabase = new DatabaseSync(databasePath);
    reopenedDatabase.exec('PRAGMA foreign_keys = ON;');
    const reopenedProxy = createProxyDatabase(reopenedDatabase);
    const reopenedInbox = createDraftInboxData(reopenedProxy);
    const recovered = await reopenedInbox.readActiveDrafts();
    assert.equal(recovered.length, 2);
    const recoveredUnknown = recovered.find(({ id }) => id === unknown.id);
    const recoveredKnown = recovered.find(({ id }) => id === known.id);
    assert.ok(recoveredUnknown);
    assert.ok(recoveredKnown);
    assert.equal(recoveredUnknown?.amount, null);
    assert.equal(recoveredUnknown?.photoKey, unknownPhotoKey);
    assert.equal(recoveredUnknown?.occurredAt.getTime(), new Date(2026, 7, 20, 10).getTime());
    assert.equal(recoveredKnown?.amount, 45_001);
    assert.equal(recoveredKnown?.photoKey, knownPhotoKey);
    assert.equal(recoveredKnown?.note, 'Known after restart');

    const reopenedTransactions = createTransactionData(
      reopenedProxy,
      createCategoryData(reopenedProxy)
    );
    const persistedComplete = await reopenedTransactions.readTransaction(complete.id);
    const persistedDeleted = await reopenedTransactions.readTransaction(deleted.id, {
      includeDeleted: true,
    });
    assert.equal(persistedComplete?.status, 'complete');
    assert.equal(persistedComplete?.amount, 12_000);
    assert.equal(persistedDeleted?.status, 'draft');
    assert.equal(persistedDeleted?.amount, 9_000);
    assert.equal(persistedDeleted?.photoKey, deletedPhotoKey);
    assert.ok(persistedDeleted?.deletedAt);

    const snapshotHarness = createDraftCompletionHarness(reopenedDatabase);
    await snapshotHarness.publisher.refresh();
    const snapshot = readySnapshot(snapshotHarness.publisher);
    assert.equal(snapshot.unloggedDrafts, 1);
    assert.equal(snapshotHarness.written[0], snapshot);
  } finally {
    firstDatabase?.close();
    reopenedDatabase?.close();
    rmSync(root, { recursive: true, force: true });
  }
});
