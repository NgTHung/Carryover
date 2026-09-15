/**
 * Promotes one prepared photo to immutable document storage.
 *
 * The destination is checked before moving to distinguish a key collision from
 * a native move that completed before reporting an error. Final bytes are
 * checked afterward in both cases, and an uncertain retained file is preserved.
 */
import type {
  PhotoCleanupIssue,
  PhotoError,
  PhotoFileAdapter,
  PhotoFileStat,
  PreparedPhoto,
  RetainedPhoto,
  RetainPhotoResult,
} from './photo-contract';
import {
  cleanupIssue,
  expectedStagedBytes,
  failedPreparation,
  ownedOutputFor,
  photoError,
  releaseOutputs,
  type PhotoStoreEntry,
} from './photo-store-support';
import type { PhotoStoreOptions } from './photo-store';

export async function retainPreparedPhoto(
  options: PhotoStoreOptions,
  entry: PhotoStoreEntry,
  prepared: PreparedPhoto
): Promise<RetainPhotoResult> {
  let staging: ReturnType<PhotoFileAdapter['createStagingFile']> | undefined;
  let retained: ReturnType<PhotoFileAdapter['createRetainedFile']> | undefined;
  const cleanupIssues: PhotoCleanupIssue[] = [...prepared.cleanupIssues];
  const releasedUris = new Set<string>();
  let primaryError: PhotoError | undefined;
  let moveError: PhotoError | undefined;
  const ownedOutput = ownedOutputFor(entry, prepared);

  try {
    staging = options.files.createStagingFile(prepared.preparationId);
    retained = options.files.createRetainedFile(prepared.photoKey);
  } catch (error) {
    primaryError = photoError('retention', 'retention-reference-failed', error);
    if (staging !== undefined) {
      await options.files.deleteStaging(staging).catch((cleanupError: unknown) => {
        cleanupIssues.push(cleanupIssue('delete-staged-output', cleanupError));
      });
    }
    await releaseOutputs(options.encoder, [ownedOutput], cleanupIssues, releasedUris);
    const failed = failedPreparation(
      prepared.preparationId,
      prepared.photoKey,
      primaryError,
      cleanupIssues
    );
    entry.state = failed;
    return { status: 'failed', preparation: failed };
  }

  try {
    const existing = await options.files.inspect(retained.uri);
    if (existing !== null) {
      primaryError = photoError(
        'retention',
        'photo-destination-exists',
        new Error(`Retained photo destination already exists for ${prepared.photoKey}`),
        { photoKey: prepared.photoKey }
      );
    }
  } catch (error) {
    primaryError = photoError('retention', 'photo-destination-inspection-failed', error, {
      photoKey: prepared.photoKey,
    });
  }

  if (primaryError !== undefined) {
    await cleanupStaging(options.files, staging, cleanupIssues);
    await releaseOutputs(options.encoder, [ownedOutput], cleanupIssues, releasedUris);
    const failed = failedPreparation(
      prepared.preparationId,
      prepared.photoKey,
      primaryError,
      cleanupIssues
    );
    entry.state = failed;
    return { status: 'failed', preparation: failed };
  }

  try {
    await options.files.promote(staging, retained);
  } catch (error) {
    moveError = photoError('retention', 'photo-promotion-failed', error, {
      photoKey: prepared.photoKey,
    });
  }

  let finalStat: PhotoFileStat | null = null;
  try {
    finalStat = await options.files.inspect(retained.uri);
  } catch (error) {
    primaryError = photoError('verification', 'retained-photo-inspection-failed', error, {
      photoKey: prepared.photoKey,
    });
  }

  let moveOwnershipEstablished = moveError === undefined;
  if (moveError !== undefined && primaryError === undefined) {
    try {
      moveOwnershipEstablished = (await options.files.inspect(staging.uri)) === null;
    } catch (error) {
      primaryError = photoError(
        'verification',
        'staged-photo-inspection-failed',
        error,
        { photoKey: prepared.photoKey }
      );
    }
  }

  const verified =
    primaryError === undefined &&
    moveOwnershipEstablished &&
    expectedStagedBytes(finalStat, prepared.metrics.bytes);
  if (verified && finalStat !== null) {
    await cleanupStaging(options.files, staging, cleanupIssues);
    await releaseOutputs(options.encoder, [ownedOutput], cleanupIssues, releasedUris);
    const retainedPhoto: RetainedPhoto = {
      status: 'retained',
      preparationId: prepared.preparationId,
      photoKey: prepared.photoKey,
      uri: finalStat.uri,
      metrics: prepared.metrics,
      cleanupIssues,
      ...(moveError === undefined ? {} : { recoveredFromError: moveError }),
    };
    entry.state = retainedPhoto;
    return { status: 'retained', photo: retainedPhoto };
  }

  if (primaryError === undefined) {
    primaryError =
      moveError ??
      photoError(
        'verification',
        'retained-photo-verification-failed',
        new Error(
          finalStat === null
            ? `Retained photo is missing for ${prepared.photoKey}`
            : `Retained photo size did not match for ${prepared.photoKey}`
        ),
        { photoKey: prepared.photoKey, expectedBytes: prepared.metrics.bytes }
      );
  }

  await cleanupStaging(options.files, staging, cleanupIssues);
  await releaseOutputs(options.encoder, [ownedOutput], cleanupIssues, releasedUris);
  const failed = failedPreparation(
    prepared.preparationId,
    prepared.photoKey,
    primaryError,
    cleanupIssues
  );
  entry.state = failed;
  return { status: 'failed', preparation: failed };
}

async function cleanupStaging(
  files: PhotoFileAdapter,
  staging: ReturnType<PhotoFileAdapter['createStagingFile']> | undefined,
  cleanupIssues: PhotoCleanupIssue[]
): Promise<void> {
  if (staging === undefined) {
    return;
  }
  try {
    await files.deleteStaging(staging);
  } catch (error) {
    cleanupIssues.push(cleanupIssue('delete-staged-output', error));
  }
}
