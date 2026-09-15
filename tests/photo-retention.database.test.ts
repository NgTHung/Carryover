import { strict as assert } from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { computeBudget } from '../src/budget/compute-budget';
import { readBudgetInput } from '../src/budget/snapshot-source';
import { createAccountData } from '../src/data/accounts';
import { createCategoryData } from '../src/data/categories';
import { createCommitmentData } from '../src/data/commitments';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createMonthConfigData } from '../src/data/month-config';
import { createPeriodPreparationData } from '../src/data/period-preparation';
import { createShareData } from '../src/data/shares';
import { createTransactionData } from '../src/data/transactions';
import type {
  PhotoEncoder,
  PhotoFileAdapter,
  PhotoKey,
} from '../src/photos/photo-contract';
import { createPhotoStore } from '../src/photos/photo-store';
import { parsePhotoKey } from '../src/photos/photo-contract';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const now = new Date(2026, 8, 15, 12, 0, 0);
const firstKey = parsePhotoKey(
  'photos/v1/123e4567-e89b-42d3-a456-426614174000.jpg'
);
const secondKey = parsePhotoKey(
  'photos/v1/123e4567-e89b-42d3-a456-426614174001.jpg'
);
const thirdKey = parsePhotoKey(
  'photos/v1/123e4567-e89b-42d3-a456-426614174002.jpg'
);

function retainedPath(root: string, photoKey: PhotoKey): string {
  return join(root, ...photoKey.split('/'));
}

function createDiskPhotoAdapter(root: string): PhotoFileAdapter {
  const stagingDirectory = join(root, 'capture-staging');
  const retainedDirectory = join(root, 'photos', 'v1');
  const stat = (uri: string) => {
    if (!existsSync(uri)) return null;
    const bytes = statSync(uri).size;
    return { uri, bytes };
  };

  return {
    async initialize(): Promise<void> {
      rmSync(stagingDirectory, { recursive: true, force: true });
      mkdirSync(stagingDirectory, { recursive: true });
    },
    createStagingFile(preparationId) {
      return {
        kind: 'staging',
        preparationId,
        uri: join(stagingDirectory, `${preparationId}.jpg`),
      };
    },
    createRetainedFile(photoKey) {
      return {
        kind: 'retained',
        photoKey,
        uri: retainedPath(root, photoKey),
      };
    },
    async copyIntoStaging(sourceUri, destination): Promise<void> {
      if (existsSync(destination.uri)) {
        throw new Error('staging destination exists');
      }
      copyFileSync(sourceUri, destination.uri);
    },
    async promote(source, destination): Promise<void> {
      mkdirSync(retainedDirectory, { recursive: true });
      if (existsSync(destination.uri)) {
        throw new Error('retained destination exists');
      }
      copyFileSync(source.uri, destination.uri);
      unlinkSync(source.uri);
    },
    async inspect(uri) {
      return stat(uri);
    },
    async deleteStaging(file): Promise<void> {
      if (existsSync(file.uri)) unlinkSync(file.uri);
    },
    async resolve(photoKey) {
      return stat(retainedPath(root, photoKey));
    },
  };
}

function createDiskPhotoEncoder(root: string, keys: readonly number[] = [120_000]): PhotoEncoder {
  const outputDirectory = join(root, 'encoded-cache');
  mkdirSync(outputDirectory, { recursive: true });
  let outputNumber = 0;
  return {
    async readDimensions() {
      return { width: 2_400, height: 1_800 };
    },
    async encode(_source, attempt) {
      outputNumber += 1;
      const uri = join(outputDirectory, `output-${outputNumber}.jpg`);
      const byteCount = keys[attempt.attempt - 1] ?? keys.at(-1);
      if (byteCount === undefined) throw new Error('Missing encoder fixture size');
      writeFileSync(uri, Buffer.alloc(byteCount));
      return { uri, dimensions: attempt.dimensions };
    },
    async release(output): Promise<void> {
      if (existsSync(output.uri)) unlinkSync(output.uri);
    },
  };
}

function bankId(database: DatabaseSync): string {
  const row = database
    .prepare("SELECT id FROM accounts WHERE name = 'Bank'")
    .get() as { id: string } | undefined;
  if (row === undefined) throw new Error('Missing bank account');
  return row.id;
}

function groceriesId(database: DatabaseSync): string {
  const row = database
    .prepare("SELECT id FROM categories WHERE name = 'Groceries'")
    .get() as { id: string } | undefined;
  if (row === undefined) throw new Error('Missing groceries category');
  return row.id;
}

function createPhotoStoreFor(
  root: string,
  keys: readonly PhotoKey[]
): ReturnType<typeof createPhotoStore> {
  let keyIndex = 0;
  return createPhotoStore({
    files: createDiskPhotoAdapter(root),
    encoder: createDiskPhotoEncoder(root),
    keyFactory: () => {
      const key = keys[keyIndex] ?? keys[keys.length - 1];
      keyIndex += 1;
      return key;
    },
    now: () => 1_000,
  });
}

test('retained photo keys survive SQLite close, reopen, completion, and soft deletion', async () => {
  const root = mkdtempSync(join(tmpdir(), 'carryover-photo-retention-'));
  const databasePath = join(root, 'carryover.db');
  try {
    const firstDatabase = openMigratedDatabase(databasePath);
    let draftId: string;
    try {
      const proxy = createProxyDatabase(firstDatabase);
      const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
      const transactions = createTransactionData(
        proxy,
        createCategoryData(proxy),
        notifier
      );
      const store = createPhotoStoreFor(root, [firstKey]);
      const prepared = await store.preparePhoto('camera://receipt.heic');
      assert.equal(prepared.status, 'prepared');
      if (prepared.status !== 'prepared') throw new Error('Photo did not prepare');
      const retained = await store.retainPhoto(prepared.photo);
      assert.equal(retained.status, 'retained');
      if (retained.status !== 'retained') throw new Error('Photo did not retain');

      const draft = await transactions.createTransaction({
        accountId: bankId(firstDatabase),
        direction: 'expense',
        status: 'draft',
        amount: ' ',
        occurredAt: now,
        photoKey: retained.photo.photoKey,
      });
      draftId = draft.id;
      assert.equal(draft.amount, null);
      assert.equal(draft.photoKey, firstKey);
      assert.deepEqual(
        Object.keys(draft).filter((key) => key.toLowerCase().includes('photo')),
        ['photoKey']
      );
      assert.equal(JSON.stringify(draft).includes(retained.photo.uri), false);
      assert.equal(existsSync(retainedPath(root, firstKey)), true);
    } finally {
      firstDatabase.close();
    }

    const reopened = new DatabaseSync(databasePath);
    reopened.exec('PRAGMA foreign_keys = ON;');
    try {
      const proxy = createProxyDatabase(reopened);
      const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
      const transactions = createTransactionData(
        proxy,
        createCategoryData(proxy),
        notifier
      );
      const restartedStore = createPhotoStoreFor(root, [secondKey]);
      const available = await restartedStore.resolvePhoto(firstKey);
      assert.equal(available.status, 'available');
      if (available.status !== 'available') throw new Error('Photo did not resolve after reopen');
      assert.equal(available.uri, retainedPath(root, firstKey));

      const completed = await transactions.completeDraft({
        transactionId: draftId,
        amount: 12_345,
        categoryId: groceriesId(reopened),
      });
      assert.equal(completed.status, 'complete');
      assert.equal(completed.amount, 12_345);
      assert.equal(completed.photoKey, firstKey);

      await transactions.softDeleteTransaction(draftId);
      assert.equal(await transactions.readTransaction(draftId), undefined);
      const deleted = await transactions.readTransaction(draftId, { includeDeleted: true });
      assert.equal(deleted?.photoKey, firstKey);
      assert.equal(deleted?.amount, 12_345);
      assert.equal((await restartedStore.resolvePhoto(firstKey)).status, 'available');
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('missing retained files do not change known or unknown budget values', async () => {
  const root = mkdtempSync(join(tmpdir(), 'carryover-photo-budget-'));
  const databasePath = join(root, 'carryover.db');
  try {
    const database = openMigratedDatabase(databasePath);
    try {
      const proxy = createProxyDatabase(database);
      const silentNotifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
      const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
      const transactions = createTransactionData(
        proxy,
        createCategoryData(proxy, silentNotifier),
        notifier
      );
      await createPeriodPreparationData(proxy, {
        now: () => now,
        changeNotifier: silentNotifier,
      }).prepareCurrentPeriod(now);

      const store = createPhotoStoreFor(root, [firstKey, secondKey, thirdKey]);
      const firstPrepared = await store.preparePhoto('camera://unknown.jpg');
      const secondPrepared = await store.preparePhoto('camera://known.jpg');
      if (firstPrepared.status !== 'prepared' || secondPrepared.status !== 'prepared') {
        throw new Error('Fixture photos did not prepare');
      }
      assert.equal((await store.retainPhoto(firstPrepared.photo)).status, 'retained');
      assert.equal((await store.retainPhoto(secondPrepared.photo)).status, 'retained');

      const unknown = await transactions.createTransaction({
        accountId: bankId(database),
        direction: 'expense',
        status: 'draft',
        amount: '  ',
        occurredAt: now,
        photoKey: firstKey,
      });
      const known = await transactions.createTransaction({
        accountId: bankId(database),
        direction: 'expense',
        status: 'draft',
        amount: 12_345,
        occurredAt: now,
        photoKey: secondKey,
      });

      const reads = {
        accounts: createAccountData(proxy, silentNotifier),
        commitments: createCommitmentData(proxy, silentNotifier),
        monthConfig: createMonthConfigData(proxy, silentNotifier),
        shares: createShareData(proxy),
        transactions: createTransactionData(
          proxy,
          createCategoryData(proxy, silentNotifier),
          silentNotifier
        ),
      };
      const inputBefore = await readBudgetInput(reads, now);
      const before = computeBudget({ ...inputBefore, updatedAt: '2026-09-15T12:00:00.000Z' });
      const beforeRows = inputBefore.transactions.map((transaction) => ({
        id: transaction.id,
        status: transaction.status,
        amount: transaction.amount,
      }));

      unlinkSync(retainedPath(root, firstKey));
      const missing = await store.resolvePhoto(firstKey);
      assert.equal(missing.status, 'unavailable');
      if (missing.status === 'unavailable') assert.equal(missing.reason, 'missing');

      const inputAfter = await readBudgetInput(reads, now);
      const after = computeBudget({ ...inputAfter, updatedAt: '2026-09-15T12:00:00.000Z' });
      assert.deepEqual(after, before);
      assert.deepEqual(
        inputAfter.transactions.map((transaction) => ({
          id: transaction.id,
          status: transaction.status,
          amount: transaction.amount,
        })),
        beforeRows
      );
      assert.equal(
        inputAfter.transactions.find(({ id }) => id === unknown.id)?.amount,
        null
      );
      assert.equal(
        inputAfter.transactions.find(({ id }) => id === known.id)?.amount,
        12_345
      );
      assert.equal(after.unloggedDrafts, 1);
    } finally {
      database.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a rejected SQL draft write leaves its retained photo and emits no ledger change', async () => {
  const root = mkdtempSync(join(tmpdir(), 'carryover-photo-sql-failure-'));
  const databasePath = join(root, 'carryover.db');
  try {
    const database = openMigratedDatabase(databasePath);
    try {
      const proxy = createProxyDatabase(database);
      const changes: string[] = [];
      const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
      notifier.subscribe(({ table, mutation }) => changes.push(`${table}:${mutation}`));
      const transactions = createTransactionData(
        proxy,
        createCategoryData(proxy),
        notifier
      );
      const store = createPhotoStoreFor(root, [thirdKey]);
      const prepared = await store.preparePhoto('camera://retry.jpg');
      if (prepared.status !== 'prepared') throw new Error('Photo did not prepare');
      const retained = await store.retainPhoto(prepared.photo);
      if (retained.status !== 'retained') throw new Error('Photo did not retain');

      database.exec(
        `CREATE TRIGGER reject_capture_insert BEFORE INSERT ON transactions
         WHEN NEW.photo_key = '${thirdKey}'
         BEGIN SELECT RAISE(ABORT, 'capture draft rejected'); END;`
      );
      const beforeCount = (database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count;
      await assert.rejects(
        transactions.createTransaction({
          accountId: bankId(database),
          direction: 'expense',
          status: 'draft',
          amount: ' ',
          occurredAt: now,
          photoKey: thirdKey,
        }),
        (error: unknown) =>
          error instanceof Error && error.message.includes('Failed query')
      );
      const afterCount = (database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count;
      assert.equal(afterCount, beforeCount);
      assert.deepEqual(changes, []);
      assert.equal(existsSync(retainedPath(root, thirdKey)), true);
      assert.equal((await store.resolvePhoto(thirdKey)).status, 'available');
    } finally {
      database.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
