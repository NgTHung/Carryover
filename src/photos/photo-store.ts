/**
 * Owns photo preparation, promotion, cleanup, and resolution.
 *
 * File retention is deliberately separate from SQLite. A prepared handle owns
 * only its staging and encoder outputs, while a promoted file is immutable and
 * is never removed by cancellation or database failure.
 */
import {
  parsePhotoKey,
  photoSourceUri,
  type DiscardPhotoResult,
  type PhotoAvailability,
  type PhotoCleanupIssue,
  type PhotoEncoder,
  type PhotoError,
  type PhotoFileAdapter,
  type PhotoKey,
  type PhotoKeyFactory,
  type PhotoPreparation,
  type PhotoPreparationId,
  type PreparedPhoto,
  type PreparePhotoResult,
  type RetainPhotoResult,
  type PhotoSource,
} from './photo-contract';
import {
  PHOTO_TARGET_BYTES,
  planPhotoEncoding,
  selectPhotoCandidate,
  type EncodedPhotoCandidate,
} from './photo-policy';
import { retainPreparedPhoto } from './photo-retention';
import { discardPhotoFiles } from './photo-discard';
import {
  cleanupPreparedFiles,
  expectedStagedBytes,
  failedPreparation,
  invalidStateError,
  photoError,
  releaseOutputs,
  type OwnedOutput,
  type PhotoStoreEntry,
} from './photo-store-support';
import { resolvePhoto } from './photo-resolution';

export type PreparePhotoOptions = {
  signal?: AbortSignal;
};

export type PhotoStore = {
  preparePhoto(
    source: PhotoSource,
    options?: PreparePhotoOptions
  ): Promise<PreparePhotoResult>;
  retainPhoto(prepared: PreparedPhoto): Promise<RetainPhotoResult>;
  discardPreparedPhoto(prepared: PreparedPhoto): Promise<DiscardPhotoResult>;
  resolvePhoto(photoKey: string | null): Promise<PhotoAvailability>;
};

export type PhotoStoreOptions = {
  files: PhotoFileAdapter;
  encoder: PhotoEncoder;
  keyFactory: PhotoKeyFactory;
  now?: () => number;
};

class PhotoCancelledError extends Error {
  constructor() {
    super('Photo preparation was cancelled');
    this.name = 'PhotoCancelledError';
  }
}

function isCancelled(error: unknown, signal: AbortSignal | undefined): boolean {
  return error instanceof PhotoCancelledError || signal?.aborted === true;
}

function assertNotCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new PhotoCancelledError();
  }
}

export function createPhotoStore(options: PhotoStoreOptions): PhotoStore {
  const now = options.now ?? Date.now;
  const handles = new WeakMap<PreparedPhoto, PhotoStoreEntry>();
  let nextPreparationNumber = 1;
  let initialization: Promise<void> | undefined;

  function preparationId(): PhotoPreparationId {
    const id = `capture-${nextPreparationNumber}`;
    nextPreparationNumber += 1;
    return id;
  }

  function ensureInitialized(): Promise<void> {
    if (initialization !== undefined) {
      return initialization;
    }
    const pending = options.files.initialize();
    const tracked = pending.catch((error: unknown) => {
      if (initialization === tracked) {
        initialization = undefined;
      }
      throw error;
    });
    initialization = tracked;
    return initialization;
  }

  async function preparePhoto(
    source: PhotoSource,
    prepareOptions: PreparePhotoOptions = {}
  ): Promise<PreparePhotoResult> {
    const id = preparationId();
    const startedAt = now();
    const signal = prepareOptions.signal;
    let photoKey: PhotoKey | null = null;
    let staging: ReturnType<PhotoFileAdapter['createStagingFile']> | undefined;
    const outputs: OwnedOutput[] = [];
    const releasedUris = new Set<string>();
    const cleanupIssues: PhotoCleanupIssue[] = [];
    let phase: PhotoError['phase'] = 'initialization';

    try {
      assertNotCancelled(signal);
      await ensureInitialized();
      assertNotCancelled(signal);

      const sourceUri = photoSourceUri(source);
      if (sourceUri.length === 0) {
        throw new Error('photo source URI is empty');
      }

      phase = 'decode';
      const originalDimensions = await options.encoder.readDimensions(sourceUri);
      assertNotCancelled(signal);
      const plan = planPhotoEncoding(originalDimensions);
      const candidates: EncodedPhotoCandidate[] = [];

      for (const attempt of plan) {
        assertNotCancelled(signal);
        phase = 'encode';
        const output = await options.encoder.encode(sourceUri, attempt);
        outputs.push({
          output,
          candidate: {
            originalDimensions,
            outputDimensions: output.dimensions,
            bytes: 0,
            attempt: attempt.attempt,
            elapsedMs: Math.max(0, now() - startedAt),
            uri: output.uri,
          },
        });
        phase = 'verification';
        const stat = await options.files.inspect(output.uri);
        if (stat === null || !Number.isSafeInteger(stat.bytes) || stat.bytes <= 0) {
          throw new Error(`Encoded photo output is empty or has invalid size: ${output.uri}`);
        }
        const owned = outputs[outputs.length - 1];
        owned.candidate.bytes = stat.bytes;
        candidates.push(owned.candidate);
        assertNotCancelled(signal);
        if (stat.bytes <= PHOTO_TARGET_BYTES) {
          break;
        }
      }

      const selectedCandidate = selectPhotoCandidate(candidates);
      const selected = outputs.find(
        (owned) => owned.candidate.uri === selectedCandidate.uri
      );
      if (selected === undefined) {
        throw new Error('Selected photo output is no longer owned');
      }
      await releaseOutputs(
        options.encoder,
        outputs.filter((owned) => owned !== selected),
        cleanupIssues,
        releasedUris
      );
      assertNotCancelled(signal);

      phase = 'staging';
      photoKey = parsePhotoKey(options.keyFactory());
      staging = options.files.createStagingFile(id);
      await options.files.copyIntoStaging(selected.output.uri, staging);
      assertNotCancelled(signal);

      phase = 'verification';
      const stagedStat = await options.files.inspect(staging.uri);
      if (!expectedStagedBytes(stagedStat, selectedCandidate.bytes)) {
        throw new Error(
          `Staged photo size did not match the encoded output for ${photoKey}`
        );
      }
      assertNotCancelled(signal);

      const prepared: PreparedPhoto = {
        status: 'prepared',
        preparationId: id,
        photoKey,
        stagingUri: staging.uri,
        encodedUri: selected.output.uri,
        metrics: {
          ...selectedCandidate,
          elapsedMs: Math.max(0, now() - startedAt),
        },
        cleanupIssues,
      };
      handles.set(prepared, { state: prepared, encodedOutput: selected.output });
      return { status: 'prepared', photo: prepared };
    } catch (error) {
      const cancelled = isCancelled(error, signal);
      const primaryError = cancelled
        ? photoError('cancellation', 'cancelled', error)
        : photoError(phase, `photo-${phase}-failed`, error);
      await cleanupPreparedFiles(
        options.files,
        options.encoder,
        staging,
        outputs,
        cleanupIssues,
        releasedUris
      );
      const failed = failedPreparation(
        id,
        photoKey,
        primaryError,
        cleanupIssues
      );
      return cancelled
        ? { status: 'cancelled', preparation: failed, cleanupIssues }
        : { status: 'failed', preparation: failed };
    }
  }

  async function retainPhoto(prepared: PreparedPhoto): Promise<RetainPhotoResult> {
    const entry = handles.get(prepared);
    if (entry === undefined) {
      return {
        status: 'failed',
        preparation: invalidStateError(prepared, 'unknown to this photo store'),
      };
    }
    if (entry.retainPromise !== undefined) {
      return entry.retainPromise;
    }
    if (entry.discardPromise !== undefined) {
      await entry.discardPromise;
      if (entry.state.status === 'retained') {
        return { status: 'retained', photo: entry.state };
      }
      return {
        status: 'failed',
        preparation: invalidStateError(prepared, entry.state.status),
      };
    }
    if (entry.state.status === 'retained') {
      return { status: 'retained', photo: entry.state };
    }
    if (entry.state.status !== 'prepared') {
      return {
        status: 'failed',
        preparation: invalidStateError(prepared, entry.state.status),
      };
    }

    const retaining: PhotoPreparation = {
      status: 'retaining',
      preparationId: prepared.preparationId,
      photoKey: prepared.photoKey,
      stagingUri: prepared.stagingUri,
      encodedUri: prepared.encodedUri,
      metrics: prepared.metrics,
    };
    entry.state = retaining;
    const pending = retainPreparedPhoto(options, entry, prepared);
    entry.retainPromise = pending;
    return pending;
  }

  async function discardPreparedPhoto(
    prepared: PreparedPhoto
  ): Promise<DiscardPhotoResult> {
    const entry = handles.get(prepared);
    if (entry === undefined) {
      return {
        status: 'failed',
        preparation: invalidStateError(prepared, 'unknown to this photo store'),
      };
    }
    if (entry.discardPromise !== undefined) {
      return entry.discardPromise;
    }
    if (entry.retainPromise !== undefined) {
      entry.discardPromise = entry.retainPromise;
      return entry.discardPromise;
    }
    if (entry.state.status === 'retained') {
      const result = { status: 'retained' as const, photo: entry.state };
      entry.discardPromise = Promise.resolve(result);
      return entry.discardPromise;
    }
    if (entry.state.status === 'discarded') {
      const result = { status: 'discarded' as const, photo: entry.state };
      entry.discardPromise = Promise.resolve(result);
      return entry.discardPromise;
    }
    if (entry.state.status !== 'prepared') {
      const result = {
        status: 'failed' as const,
        preparation: invalidStateError(prepared, entry.state.status),
      };
      entry.discardPromise = Promise.resolve(result);
      return entry.discardPromise;
    }

    const discarded = {
      status: 'discarded' as const,
      preparationId: prepared.preparationId,
      photoKey: prepared.photoKey,
    };
    entry.state = discarded;
    entry.discardPromise = discardPhotoFiles(options, entry, prepared, discarded);
    return entry.discardPromise;
  }

  return {
    preparePhoto,
    retainPhoto,
    discardPreparedPhoto,
    resolvePhoto: (photoKey) => resolvePhoto(options.files, photoKey),
  };
}
