import { strict as assert } from 'node:assert';

import {
  parsePhotoKey,
  type PhotoEncoder,
  type PhotoFileAdapter,
  type PhotoKey,
  type PreparedPhoto,
} from '../src/photos/photo-contract';
import { createPhotoStore } from '../src/photos/photo-store';
import { createUnsupportedPhotoAccess } from '../src/photos/photo-unsupported';

const firstKey = parsePhotoKey(
  'photos/v1/123e4567-e89b-42d3-a456-426614174000.jpg'
);
const secondKey = parsePhotoKey(
  'photos/v1/123e4567-e89b-42d3-a456-426614174001.jpg'
);

type HarnessConfig = {
  bytes?: readonly number[];
  failDecode?: Error;
  failEncodeAttempt?: number;
  failInspect?: readonly string[];
  failCopy?: boolean;
  partialCopyFailure?: boolean;
  failDeleteStaging?: boolean;
  blockDeleteStaging?: boolean;
  failRelease?: boolean;
  throwAfterMove?: boolean;
  createFinalThenThrow?: boolean;
  retainedBytes?: number;
  blockEncode?: boolean;
  blockCopy?: boolean;
  keys?: readonly PhotoKey[];
};

type Harness = {
  store: ReturnType<typeof createPhotoStore>;
  files: PhotoFileAdapter;
  staging: Map<string, number>;
  retained: Map<string, number>;
  outputs: Map<string, number>;
  encodeCount: number;
  encodedSources: string[];
  releasedOutputs: string[];
  initializeCount: number;
  promoteCount: number;
  deleteStagingCount: number;
  encodeStarted: Promise<void>;
  releaseEncode: () => void;
  copyStarted: Promise<void>;
  releaseCopy: () => void;
  deleteStagingStarted: Promise<void>;
  releaseDeleteStaging: () => void;
};

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolvePromise: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function makeHarness(config: HarnessConfig = {}): Harness {
  const bytes = config.bytes ?? [280_000, 220_000, 180_000];
  const staging = new Map<string, number>();
  const retained = new Map<string, number>();
  const outputs = new Map<string, number>();
  const encodeBarrier = deferred();
  const copyBarrier = deferred();
  const deleteStagingBarrier = deferred();
  let encodeStartedResolve: () => void = () => undefined;
  let copyStartedResolve: () => void = () => undefined;
  let deleteStagingStartedResolve: () => void = () => undefined;
  const encodeStarted = new Promise<void>((resolve) => {
    encodeStartedResolve = resolve;
  });
  const copyStarted = new Promise<void>((resolve) => {
    copyStartedResolve = resolve;
  });
  const deleteStagingStarted = new Promise<void>((resolve) => {
    deleteStagingStartedResolve = resolve;
  });
  let encodeCount = 0;
  let initializeCount = 0;
  let promoteCount = 0;
  let deleteStagingCount = 0;
  let keyIndex = 0;
  const encodedSources: string[] = [];
  const releasedOutputs: string[] = [];
  const configuredKeys = config.keys ?? [firstKey, secondKey];

  const files: PhotoFileAdapter = {
    async initialize(): Promise<void> {
      initializeCount += 1;
      staging.clear();
    },
    createStagingFile(preparationId) {
      return {
        kind: 'staging',
        preparationId,
        uri: `staging:${preparationId}`,
      };
    },
    createRetainedFile(photoKey) {
      return { kind: 'retained', photoKey, uri: `retained:${photoKey}` };
    },
    async copyIntoStaging(sourceUri, destination): Promise<void> {
      if (config.blockCopy) {
        copyStartedResolve();
        await copyBarrier.promise;
      }
      if (config.failCopy) {
        if (config.partialCopyFailure) {
          staging.set(destination.uri, 1);
        }
        throw new Error('staging storage is full');
      }
      const outputBytes = outputs.get(sourceUri);
      if (outputBytes === undefined) {
        throw new Error(`encoded output is missing: ${sourceUri}`);
      }
      staging.set(destination.uri, outputBytes);
    },
    async promote(source, destination): Promise<void> {
      promoteCount += 1;
      if (retained.has(destination.uri)) {
        throw new Error('destination exists');
      }
      const stagedBytes = staging.get(source.uri);
      if (stagedBytes === undefined) {
        throw new Error('staging output is missing');
      }
      retained.set(destination.uri, config.retainedBytes ?? stagedBytes);
      if (!config.createFinalThenThrow) {
        staging.delete(source.uri);
      }
      if (config.throwAfterMove) {
        throw new Error('move completed before the native call reported an error');
      }
      if (config.createFinalThenThrow) {
        throw new Error('move reported an error while staging remained');
      }
    },
    async inspect(uri): Promise<{ uri: string; bytes: number } | null> {
      if (config.failInspect?.includes(uri)) {
        throw new Error(`cannot inspect ${uri}`);
      }
      const bytesForUri = outputs.get(uri) ?? staging.get(uri) ?? retained.get(uri);
      return bytesForUri === undefined ? null : { uri, bytes: bytesForUri };
    },
    async deleteStaging(file): Promise<void> {
      deleteStagingCount += 1;
      if (config.blockDeleteStaging) {
        deleteStagingStartedResolve();
        await deleteStagingBarrier.promise;
      }
      if (config.failDeleteStaging) {
        throw new Error('staging cleanup failed');
      }
      staging.delete(file.uri);
    },
    async resolve(photoKey) {
      const uri = `retained:${photoKey}`;
      if (config.failInspect?.includes(uri)) {
        throw new Error(`cannot inspect ${uri}`);
      }
      const bytesForUri = retained.get(uri);
      return bytesForUri === undefined ? null : { uri, bytes: bytesForUri };
    },
  };

  const encoder: PhotoEncoder = {
    async readDimensions(): Promise<{ width: number; height: number }> {
      if (config.failDecode !== undefined) {
        throw config.failDecode;
      }
      return { width: 4_000, height: 3_000 };
    },
    async encode(sourceUri, attempt) {
      encodedSources.push(sourceUri);
      encodeCount += 1;
      if (config.blockEncode) {
        encodeStartedResolve();
        await encodeBarrier.promise;
      }
      if (config.failEncodeAttempt === attempt.attempt) {
        throw new Error(`encoding attempt ${attempt.attempt} failed`);
      }
      const uri = `output:${attempt.attempt}:${encodeCount}`;
      outputs.set(uri, bytes[attempt.attempt - 1] ?? bytes[bytes.length - 1]);
      return { uri, dimensions: attempt.dimensions };
    },
    async release(output): Promise<void> {
      releasedOutputs.push(output.uri);
      if (config.failRelease) {
        throw new Error('encoder output cleanup failed');
      }
      outputs.delete(output.uri);
    },
  };

  const store = createPhotoStore({
    files,
    encoder,
    keyFactory: () => {
      const key = configuredKeys[keyIndex] ?? firstKey;
      keyIndex += 1;
      return key;
    },
    now: () => 1_000,
  });

  return {
    store,
    files,
    staging,
    retained,
    outputs,
    get encodeCount() {
      return encodeCount;
    },
    encodedSources,
    releasedOutputs,
    get initializeCount() {
      return initializeCount;
    },
    get promoteCount() {
      return promoteCount;
    },
    get deleteStagingCount() {
      return deleteStagingCount;
    },
    encodeStarted,
    releaseEncode: encodeBarrier.resolve,
    copyStarted,
    releaseCopy: copyBarrier.resolve,
    deleteStagingStarted,
    releaseDeleteStaging: deleteStagingBarrier.resolve,
  };
}

function preparedFrom(result: Awaited<ReturnType<Harness['store']['preparePhoto']>>): PreparedPhoto {
  if (result.status !== 'prepared') {
    throw new Error(`expected prepared photo, received ${result.status}`);
  }
  return result.photo;
}

test('preparation stages the first target-sized output and retention is idempotent', async () => {
  const harness = makeHarness({ bytes: [280_000, 200_000, 150_000] });
  const prepared = preparedFrom(await harness.store.preparePhoto('camera://receipt.heic'));

  assert.equal(prepared.photoKey, firstKey);
  assert.equal(prepared.metrics.attempt, 2);
  assert.equal(prepared.metrics.bytes, 200_000);
  assert.equal(harness.encodeCount, 2);
  assert.deepEqual(harness.encodedSources, [
    'camera://receipt.heic',
    'camera://receipt.heic',
  ]);
  assert.equal(harness.outputs.size, 1);
  assert.equal(harness.staging.get(prepared.stagingUri), 200_000);

  const [first, second] = await Promise.all([
    harness.store.retainPhoto(prepared),
    harness.store.retainPhoto(prepared),
  ]);
  assert.equal(first.status, 'retained');
  assert.equal(first, second);
  assert.equal(harness.promoteCount, 1);
  assert.equal(harness.outputs.size, 0);
  assert.equal((await harness.store.resolvePhoto(firstKey)).status, 'available');

  const afterRetention = await harness.store.discardPreparedPhoto(prepared);
  assert.equal(afterRetention.status, 'retained');
  assert.equal(harness.retained.size, 1);
});

test('all oversized outputs retain the smallest output and use attempt order for ties', async () => {
  const harness = makeHarness({ bytes: [300_000, 240_000, 240_000] });
  const prepared = preparedFrom(await harness.store.preparePhoto('camera://receipt.jpg'));

  assert.equal(prepared.metrics.attempt, 2);
  assert.equal(prepared.metrics.bytes, 240_000);
  assert.deepEqual(harness.releasedOutputs, ['output:1:1', 'output:3:3']);
});

test('already-cancelled preparation does no native work', async () => {
  const harness = makeHarness();
  const controller = new AbortController();
  controller.abort();

  const result = await harness.store.preparePhoto('camera://receipt.jpg', {
    signal: controller.signal,
  });
  assert.equal(result.status, 'cancelled');
  assert.equal(harness.initializeCount, 0);
  assert.equal(harness.encodeCount, 0);
});

test('cancellation during encoding awaits the operation and cleans its output', async () => {
  const harness = makeHarness({ blockEncode: true });
  const controller = new AbortController();
  const pending = harness.store.preparePhoto('camera://receipt.jpg', {
    signal: controller.signal,
  });
  await harness.encodeStarted;
  controller.abort();
  harness.releaseEncode();

  const result = await pending;
  assert.equal(result.status, 'cancelled');
  assert.deepEqual(harness.releasedOutputs, ['output:1:1']);
  assert.equal(harness.outputs.size, 0);
  assert.equal(harness.staging.size, 0);
});

test('cancellation during staging removes partial staging and keeps the source untouched', async () => {
  const harness = makeHarness({ blockCopy: true });
  const controller = new AbortController();
  const pending = harness.store.preparePhoto('camera://receipt.jpg', {
    signal: controller.signal,
  });
  await harness.copyStarted;
  controller.abort();
  harness.releaseCopy();

  const result = await pending;
  assert.equal(result.status, 'cancelled');
  assert.equal(harness.staging.size, 0);
  assert.equal(harness.outputs.size, 0);
});

test('decode, encoding, and staging failures return their phase and clean owned outputs', async () => {
  const decodeFailure = await makeHarness({ failDecode: new Error('cannot decode source') })
    .store.preparePhoto('camera://bad.jpg');
  assert.equal(decodeFailure.status, 'failed');
  if (decodeFailure.status === 'failed') {
    assert.equal(decodeFailure.preparation.error.phase, 'decode');
  }

  const inspectFailureHarness = makeHarness({ failInspect: ['output:1:1'] });
  const inspectFailure = await inspectFailureHarness.store.preparePhoto('camera://bad.jpg');
  assert.equal(inspectFailure.status, 'failed');
  assert.deepEqual(inspectFailureHarness.releasedOutputs, ['output:1:1']);

  const copyFailureHarness = makeHarness({ failCopy: true, partialCopyFailure: true });
  const copyFailure = await copyFailureHarness.store.preparePhoto('camera://full.jpg');
  assert.equal(copyFailure.status, 'failed');
  assert.equal(copyFailureHarness.staging.size, 0);
  assert.deepEqual(copyFailureHarness.releasedOutputs, ['output:1:1', 'output:2:2', 'output:3:3']);
});

test('discard is terminal and repeated discard does not repeat cleanup', async () => {
  const harness = makeHarness();
  const prepared = preparedFrom(await harness.store.preparePhoto('camera://receipt.jpg'));

  const first = await harness.store.discardPreparedPhoto(prepared);
  const second = await harness.store.discardPreparedPhoto(prepared);
  assert.equal(first.status, 'discarded');
  assert.equal(second, first);
  assert.equal(harness.deleteStagingCount, 1);
  assert.equal(harness.outputs.size, 0);
  assert.equal(harness.retained.size, 0);
});

test('cleanup issues do not hide verified retention', async () => {
  const harness = makeHarness({ bytes: [200_000], failRelease: true });
  const prepared = preparedFrom(await harness.store.preparePhoto('camera://receipt.jpg'));
  const retained = await harness.store.retainPhoto(prepared);

  assert.equal(retained.status, 'retained');
  if (retained.status === 'retained') {
    assert.equal(retained.photo.cleanupIssues.length, 1);
    assert.equal(retained.photo.cleanupIssues[0].operation, 'delete-encoded-output');
  }
  assert.equal(harness.retained.size, 1);
});

test('retention detects a key collision before promotion and preserves the existing file', async () => {
  const harness = makeHarness();
  const prepared = preparedFrom(await harness.store.preparePhoto('camera://receipt.jpg'));
  harness.retained.set(`retained:${firstKey}`, 777_000);

  const result = await harness.store.retainPhoto(prepared);
  assert.equal(result.status, 'failed');
  if (result.status === 'failed') {
    assert.equal(result.preparation.error.code, 'photo-destination-exists');
  }
  assert.equal(harness.promoteCount, 0);
  assert.equal(harness.retained.get(`retained:${firstKey}`), 777_000);
});

test('a move that completes before throwing is recovered by final verification', async () => {
  const harness = makeHarness({ throwAfterMove: true });
  const prepared = preparedFrom(await harness.store.preparePhoto('camera://receipt.jpg'));

  const result = await harness.store.retainPhoto(prepared);
  assert.equal(result.status, 'retained');
  if (result.status === 'retained') {
    assert.equal(result.photo.recoveredFromError?.code, 'photo-promotion-failed');
  }
  assert.equal(harness.retained.size, 1);
  assert.equal(harness.staging.size, 0);
});

test('a same-sized final file with staging still present is not claimed as owned', async () => {
  const harness = makeHarness({ createFinalThenThrow: true });
  const prepared = preparedFrom(await harness.store.preparePhoto('camera://receipt.jpg'));

  const result = await harness.store.retainPhoto(prepared);
  assert.equal(result.status, 'failed');
  if (result.status === 'failed') {
    assert.equal(result.preparation.error.code, 'photo-promotion-failed');
  }
  assert.equal(harness.retained.size, 1);
  assert.equal(harness.staging.size, 0);
});

test('failed final verification preserves the uncertain final file', async () => {
  const harness = makeHarness({ retainedBytes: 1 });
  const prepared = preparedFrom(await harness.store.preparePhoto('camera://receipt.jpg'));

  const result = await harness.store.retainPhoto(prepared);
  assert.equal(result.status, 'failed');
  assert.equal(harness.retained.size, 1);
  assert.equal(harness.staging.size, 0);
});

test('retention races serialize with discard and never delete a promoted file', async () => {
  const harness = makeHarness({ throwAfterMove: false });
  const prepared = preparedFrom(await harness.store.preparePhoto('camera://receipt.jpg'));
  const retained = harness.store.retainPhoto(prepared);
  const discarded = harness.store.discardPreparedPhoto(prepared);
  const [retainedResult, discardedResult] = await Promise.all([retained, discarded]);

  assert.equal(retainedResult.status, 'retained');
  assert.equal(discardedResult, retainedResult);
  assert.equal(harness.retained.size, 1);
  assert.equal(harness.deleteStagingCount, 1);
});

test('discard started first prevents retention while cleanup is in progress', async () => {
  const harness = makeHarness({ blockDeleteStaging: true });
  const prepared = preparedFrom(await harness.store.preparePhoto('camera://receipt.jpg'));

  const discard = harness.store.discardPreparedPhoto(prepared);
  await harness.deleteStagingStarted;
  const retain = harness.store.retainPhoto(prepared);
  harness.releaseDeleteStaging();

  const [discardResult, retainResult] = await Promise.all([discard, retain]);
  assert.equal(discardResult.status, 'discarded');
  assert.equal(retainResult.status, 'failed');
  if (retainResult.status === 'failed') {
    assert.equal(retainResult.preparation.error.code, 'invalid-preparation-state');
  }
  assert.equal(harness.promoteCount, 0);
  assert.equal(harness.retained.size, 0);
});

test('a new store clears abandoned staging once while keeping retained files', async () => {
  const harness = makeHarness();
  const prepared = preparedFrom(await harness.store.preparePhoto('camera://receipt.jpg'));
  const retained = await harness.store.retainPhoto(prepared);
  assert.equal(retained.status, 'retained');
  harness.staging.set('staging:orphan', 42);

  const restarted = createPhotoStore({
    files: harness.files,
    encoder: {
      readDimensions: async () => ({ width: 100, height: 100 }),
      encode: async (_source, attempt) => ({
        uri: `restart-output:${attempt.attempt}`,
        dimensions: attempt.dimensions,
      }),
      release: async () => undefined,
    },
    keyFactory: () => secondKey,
  });
  await restarted.preparePhoto('camera://next.jpg');
  assert.equal(harness.staging.has('staging:orphan'), false);
  assert.equal(harness.retained.size, 1);
});

test('resolution distinguishes absent, invalid, missing, and unreadable photos', async () => {
  const harness = makeHarness();
  assert.deepEqual(await harness.store.resolvePhoto(null), { status: 'absent' });
  assert.equal(
    (await harness.store.resolvePhoto('photos/v1/../unsafe.jpg')).status,
    'unavailable'
  );
  const invalid = await harness.store.resolvePhoto('photos/v1/../unsafe.jpg');
  if (invalid.status === 'unavailable') assert.equal(invalid.reason, 'invalid-key');
  const missing = await harness.store.resolvePhoto(firstKey);
  if (missing.status === 'unavailable') assert.equal(missing.reason, 'missing');

  const unreadableHarness = makeHarness({ failInspect: [`retained:${firstKey}`] });
  unreadableHarness.retained.set(`retained:${firstKey}`, 10);
  const unreadable = await unreadableHarness.store.resolvePhoto(firstKey);
  if (unreadable.status === 'unavailable') assert.equal(unreadable.reason, 'unreadable');
});

test('browser access fails closed with the same availability contract', async () => {
  const store = createUnsupportedPhotoAccess();
  const unavailable = await store.resolvePhoto(firstKey);
  assert.equal(unavailable.status, 'unavailable');
  if (unavailable.status === 'unavailable') {
    assert.equal(unavailable.reason, 'unsupported-platform');
  }
  const prepared = await store.preparePhoto('camera://receipt.jpg');
  assert.equal(prepared.status, 'failed');
});
