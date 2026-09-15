import { strict as assert } from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createAsyncAtomicRunner } from '../src/data/atomic';
import { createCapturedDraftData } from '../src/data/captured-drafts';
import { createCategoryData } from '../src/data/categories';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createTransactionData } from '../src/data/transactions';
import {
  createPhotoStore,
  type PhotoStore,
} from '../src/photos/photo-store';
import type {
  PhotoEncoder,
  PhotoFileAdapter,
  PhotoKey,
} from '../src/photos/photo-contract';
import { parsePhotoKey } from '../src/photos/photo-contract';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const draftId = '123e4567-e89b-42d3-a456-426614174000';
const photoKey = parsePhotoKey(
  'photos/v1/123e4567-e89b-42d3-a456-426614174001.jpg'
);
const occurredAt = new Date(2026, 8, 15, 12, 30);

function retainedPath(root: string, key: PhotoKey): string {
  return join(root, ...key.split('/'));
}

function createDiskStore(root: string): PhotoStore {
  const staging = join(root, 'capture-staging');
  const encoded = join(root, 'encoded-cache');
  const source = join(root, 'camera.jpg');
  let outputNumber = 0;
  const files: PhotoFileAdapter = {
    async initialize() {
      rmSync(staging, { recursive: true, force: true });
      mkdirSync(staging, { recursive: true });
    },
    createStagingFile(preparationId) {
      return { kind: 'staging', preparationId, uri: join(staging, `${preparationId}.jpg`) };
    },
    createRetainedFile(key) {
      return { kind: 'retained', photoKey: key, uri: retainedPath(root, key) };
    },
    async copyIntoStaging(sourceUri, destination) {
      copyFileSync(sourceUri, destination.uri);
    },
    async promote(sourceFile, destination) {
      mkdirSync(join(root, 'photos', 'v1'), { recursive: true });
      if (existsSync(destination.uri)) throw new Error('retained destination exists');
      renameSync(sourceFile.uri, destination.uri);
    },
    async inspect(uri) {
      if (!existsSync(uri)) return null;
      return { uri, bytes: statSync(uri).size };
    },
    async deleteStaging(file) {
      if (existsSync(file.uri)) unlinkSync(file.uri);
    },
    async resolve(key) {
      const uri = retainedPath(root, key);
      if (!existsSync(uri)) return null;
      return { uri, bytes: statSync(uri).size };
    },
  };
  const encoder: PhotoEncoder = {
    async readDimensions() {
      return { width: 800, height: 600 };
    },
    async encode(_sourceUri, attempt) {
      mkdirSync(encoded, { recursive: true });
      const uri = join(encoded, `output-${outputNumber += 1}.jpg`);
      writeFileSync(uri, readFileSync(source));
      return { uri, dimensions: attempt.dimensions };
    },
    async release(output) {
      if (existsSync(output.uri)) unlinkSync(output.uri);
    },
  };
  writeFileSync(source, Buffer.alloc(1_024, 7));
  return createPhotoStore({
    files,
    encoder,
    keyFactory: () => photoKey,
    now: () => 1_000,
  });
}

test('a captured draft and retained photo resolve after both stores restart', async () => {
  const root = mkdtempSync(join(tmpdir(), 'carryover-capture-restart-'));
  const databasePath = join(root, 'carryover.db');
  try {
    const firstDatabase = openMigratedDatabase(databasePath);
    try {
      const proxy = createProxyDatabase(firstDatabase);
      const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
      const photos = createDiskStore(root);
      const prepared = await photos.preparePhoto(join(root, 'camera.jpg'));
      assert.equal(prepared.status, 'prepared');
      if (prepared.status !== 'prepared') throw new Error('Expected a prepared photo');
      const retained = await photos.retainPhoto(prepared.photo);
      assert.equal(retained.status, 'retained');
      if (retained.status !== 'retained') throw new Error('Expected a retained photo');

      const captured = createCapturedDraftData(proxy, notifier, {
        runAtomic: createAsyncAtomicRunner(proxy),
        now: () => occurredAt,
      });
      const draft = await captured.createCapturedDraft({
        draftId,
        photoKey: retained.photo.photoKey,
        amount: null,
        occurredAt,
      });
      assert.equal(draft.status, 'created');
      assert.equal(draft.transaction.photoKey, photoKey);
    } finally {
      firstDatabase.close();
    }

    const reopened = new DatabaseSync(databasePath);
    reopened.exec('PRAGMA foreign_keys = ON;');
    try {
      const proxy = createProxyDatabase(reopened);
      const restartedPhotos = createDiskStore(root);
      const available = await restartedPhotos.resolvePhoto(photoKey);
      assert.equal(available.status, 'available');
      if (available.status !== 'available') throw new Error('Photo did not resolve after restart');
      assert.equal(statSync(available.uri).size, 1_024);

      const transactions = createTransactionData(proxy, createCategoryData(proxy));
      const row = await transactions.readTransaction(draftId, { includeDeleted: true });
      assert.equal(row?.photoKey, photoKey);
      assert.equal(row?.amount, null);

      const replay = createCapturedDraftData(
        proxy,
        createLedgerChangeNotifier({ onListenerError: () => undefined }),
        { runAtomic: createAsyncAtomicRunner(proxy), now: () => occurredAt }
      );
      const existing = await replay.createCapturedDraft({
        draftId,
        photoKey,
        amount: null,
        occurredAt,
      });
      assert.equal(existing.status, 'existing');
      assert.equal(
        (reopened.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count,
        1
      );
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
