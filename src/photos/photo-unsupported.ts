/**
 * Browser implementation of the photo-store contract.
 *
 * The preview has no durable native photo storage. Returning explicit failure
 * states keeps browser route discovery safe and prevents false success.
 */
import type {
  DiscardPhotoResult,
  FailedPhoto,
  PhotoAvailability,
  PhotoError,
  PhotoSource,
  PreparePhotoResult,
  PreparedPhoto,
  RetainPhotoResult,
} from './photo-contract';
import type {
  PhotoStore,
  PreparePhotoOptions,
} from './photo-store';

export function unsupportedPhotoError(): PhotoError {
  return {
    phase: 'initialization',
    code: 'unsupported-platform',
    message: 'Durable capture photos are unavailable in the browser preview',
  };
}

export function unsupportedPreparation(): FailedPhoto {
  return {
    status: 'failed',
    preparationId: 'unsupported-platform',
    photoKey: null,
    error: unsupportedPhotoError(),
    cleanupIssues: [],
  };
}

export function createUnsupportedPhotoAccess(): PhotoStore {
  return {
    async preparePhoto(
      _source: PhotoSource,
      _options: PreparePhotoOptions = {}
    ): Promise<PreparePhotoResult> {
      return { status: 'failed', preparation: unsupportedPreparation() };
    },
    async retainPhoto(prepared: PreparedPhoto): Promise<RetainPhotoResult> {
      return {
        status: 'failed',
        preparation: {
          ...unsupportedPreparation(),
          preparationId: prepared.preparationId,
          photoKey: prepared.photoKey,
          cleanupIssues: prepared.cleanupIssues,
        },
      };
    },
    async discardPreparedPhoto(
      prepared: PreparedPhoto
    ): Promise<DiscardPhotoResult> {
      return {
        status: 'failed',
        preparation: {
          ...unsupportedPreparation(),
          preparationId: prepared.preparationId,
          photoKey: prepared.photoKey,
          cleanupIssues: prepared.cleanupIssues,
        },
      };
    },
    async resolvePhoto(photoKey: string | null): Promise<PhotoAvailability> {
      return photoKey === null
        ? { status: 'absent' }
        : {
            status: 'unavailable',
            photoKey,
            reason: 'unsupported-platform',
            message: unsupportedPhotoError().message,
          };
    },
  };
}

export type {
  DiscardPhotoResult,
  PhotoAvailability,
  PhotoSource,
  PreparePhotoOptions,
  PreparePhotoResult,
  PreparedPhoto,
  RetainPhotoResult,
};
