/**
 * Cleans up a prepared photo after the store has claimed the discard operation.
 *
 * The store changes the handle state before calling this function so retention
 * cannot start while asynchronous file cleanup is in progress.
 */
import type {
  DiscardedPhoto,
  DiscardPhotoResult,
  PhotoCleanupIssue,
  PreparedPhoto,
} from './photo-contract';
import {
  cleanupPreparedFiles,
  failedPreparation,
  photoError,
  type PhotoStoreEntry,
} from './photo-store-support';
import type { PhotoStoreOptions } from './photo-store';

export async function discardPhotoFiles(
  options: PhotoStoreOptions,
  entry: PhotoStoreEntry,
  prepared: PreparedPhoto,
  discarded: DiscardedPhoto
): Promise<DiscardPhotoResult> {
  const cleanupIssues: PhotoCleanupIssue[] = [...prepared.cleanupIssues];
  await cleanupPreparedFiles(
    options.files,
    options.encoder,
    {
      kind: 'staging',
      preparationId: prepared.preparationId,
      uri: prepared.stagingUri,
    },
    [
      {
        output: entry.encodedOutput ?? {
          uri: prepared.encodedUri,
          dimensions: prepared.metrics.outputDimensions,
        },
        candidate: {
          ...prepared.metrics,
          uri: prepared.encodedUri,
        },
      },
    ],
    cleanupIssues,
    new Set<string>()
  );
  if (cleanupIssues.length > 0) {
    const failed = failedPreparation(
      prepared.preparationId,
      prepared.photoKey,
      photoError(
        'cleanup',
        'photo-discard-cleanup-failed',
        new Error('Prepared photo cleanup did not complete')
      ),
      cleanupIssues
    );
    entry.state = failed;
    return { status: 'failed', preparation: failed };
  }

  entry.state = discarded;
  return { status: 'discarded', photo: discarded };
}
