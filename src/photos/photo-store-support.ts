/**
 * Shared internal helpers for the photo lifecycle.
 *
 * Keeping error and ownership mechanics here lets the store and retention
 * operation stay small without weakening their common cleanup guarantees.
 */
import type {
  FailedPhoto,
  PhotoCleanupIssue,
  PhotoEncodedOutput,
  PhotoEncoder,
  PhotoError,
  PhotoFileAdapter,
  PhotoFileStat,
  PhotoKey,
  PhotoPreparation,
  PhotoPreparationId,
  PreparedPhoto,
} from './photo-contract';
import type { EncodedPhotoCandidate } from './photo-policy';

export type OwnedOutput = {
  output: PhotoEncodedOutput;
  candidate: EncodedPhotoCandidate;
};

export type PhotoStoreEntry = {
  state: PhotoPreparation;
  encodedOutput?: PhotoEncodedOutput;
  retainPromise?: Promise<{
    status: 'retained';
    photo: import('./photo-contract').RetainedPhoto;
  } | {
    status: 'failed';
    preparation: FailedPhoto;
  }>;
  discardPromise?: Promise<import('./photo-contract').DiscardPhotoResult>;
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function photoError(
  phase: PhotoError['phase'],
  code: string,
  error: unknown,
  context?: Readonly<Record<string, string | number>>
): PhotoError {
  return {
    phase,
    code,
    message: errorMessage(error),
    ...(context === undefined ? {} : { context }),
    cause: error,
  };
}

export function cleanupIssue(
  operation: PhotoCleanupIssue['operation'],
  error: unknown
): PhotoCleanupIssue {
  return {
    operation,
    message: errorMessage(error),
    cause: error,
  };
}

export function failedPreparation(
  preparationId: PhotoPreparationId,
  photoKey: PhotoKey | null,
  error: PhotoError,
  cleanupIssues: readonly PhotoCleanupIssue[]
): FailedPhoto {
  return {
    status: 'failed',
    preparationId,
    photoKey,
    error,
    cleanupIssues,
  };
}

export function invalidStateError(
  prepared: PreparedPhoto,
  state: string
): FailedPhoto {
  return failedPreparation(
    prepared.preparationId,
    prepared.photoKey,
    {
      phase: 'retention',
      code: 'invalid-preparation-state',
      message: `Photo preparation is already ${state}`,
    },
    prepared.cleanupIssues
  );
}

export function expectedStagedBytes(
  stat: PhotoFileStat | null,
  expectedBytes: number
): boolean {
  return (
    stat !== null &&
    Number.isSafeInteger(stat.bytes) &&
    stat.bytes > 0 &&
    stat.bytes === expectedBytes
  );
}

export function ownedOutputFor(
  entry: PhotoStoreEntry,
  prepared: PreparedPhoto
): OwnedOutput {
  return {
    output: entry.encodedOutput ?? {
      uri: prepared.encodedUri,
      dimensions: prepared.metrics.outputDimensions,
    },
    candidate: {
      ...prepared.metrics,
      uri: prepared.encodedUri,
    },
  };
}

export async function releaseOutputs(
  encoder: PhotoEncoder,
  outputs: readonly OwnedOutput[],
  cleanupIssues: PhotoCleanupIssue[],
  releasedUris: Set<string>
): Promise<void> {
  for (const owned of outputs) {
    if (releasedUris.has(owned.output.uri)) {
      continue;
    }
    releasedUris.add(owned.output.uri);
    try {
      await encoder.release(owned.output);
    } catch (error) {
      cleanupIssues.push(cleanupIssue('delete-encoded-output', error));
    }
  }
}

export async function cleanupPreparedFiles(
  files: PhotoFileAdapter,
  encoder: PhotoEncoder,
  staging: ReturnType<PhotoFileAdapter['createStagingFile']> | undefined,
  outputs: readonly OwnedOutput[],
  cleanupIssues: PhotoCleanupIssue[],
  releasedUris: Set<string>
): Promise<void> {
  if (staging !== undefined) {
    try {
      await files.deleteStaging(staging);
    } catch (error) {
      cleanupIssues.push(cleanupIssue('delete-staged-output', error));
    }
  }
  await releaseOutputs(encoder, outputs, cleanupIssues, releasedUris);
}
