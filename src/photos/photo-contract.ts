/**
 * Shared contracts for retained capture photos.
 *
 * A transaction stores only a relative photo key. File URIs and preparation
 * handles stay at the photo boundary so a cache path can never become ledger
 * data. The status unions make it impossible to use a preparation after it has
 * been discarded or promoted.
 */
import { z } from 'zod';

const photoKeyPattern =
  /^photos\/v1\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg(?![\s\S])/;

/** The only key format produced by the photo store. */
export const photoKeySchema = z
  .string()
  .regex(photoKeyPattern, 'photo key must be a lowercase v4 JPEG key');

export type PhotoKey = z.infer<typeof photoKeySchema>;

export function parsePhotoKey(value: unknown): PhotoKey {
  return photoKeySchema.parse(value);
}

export function isPhotoKey(value: unknown): value is PhotoKey {
  return photoKeySchema.safeParse(value).success;
}

export type PhotoSource = string | { uri: string };

export function photoSourceUri(source: PhotoSource): string {
  return typeof source === 'string' ? source : source.uri;
}

export type PhotoDimensions = {
  width: number;
  height: number;
};

export type PhotoMetrics = {
  originalDimensions: PhotoDimensions;
  outputDimensions: PhotoDimensions;
  bytes: number;
  attempt: number;
  elapsedMs: number;
};

export type PhotoPreparationId = string;

export type PreparingPhoto = {
  status: 'preparing';
  preparationId: PhotoPreparationId;
  sourceUri: string;
};

export type PreparedPhoto = {
  status: 'prepared';
  preparationId: PhotoPreparationId;
  photoKey: PhotoKey;
  stagingUri: string;
  encodedUri: string;
  metrics: PhotoMetrics;
  cleanupIssues: readonly PhotoCleanupIssue[];
};

export type RetainingPhoto = {
  status: 'retaining';
  preparationId: PhotoPreparationId;
  photoKey: PhotoKey;
  stagingUri: string;
  encodedUri: string;
  metrics: PhotoMetrics;
};

export type RetainedPhoto = {
  status: 'retained';
  preparationId: PhotoPreparationId;
  photoKey: PhotoKey;
  uri: string;
  metrics: PhotoMetrics;
  cleanupIssues: readonly PhotoCleanupIssue[];
  recoveredFromError?: PhotoError;
};

export type DiscardedPhoto = {
  status: 'discarded';
  preparationId: PhotoPreparationId;
  photoKey: PhotoKey | null;
};

export type FailedPhoto = {
  status: 'failed';
  preparationId: PhotoPreparationId;
  photoKey: PhotoKey | null;
  error: PhotoError;
  cleanupIssues: readonly PhotoCleanupIssue[];
};

export type PhotoPreparation =
  | PreparingPhoto
  | PreparedPhoto
  | RetainingPhoto
  | RetainedPhoto
  | DiscardedPhoto
  | FailedPhoto;

export type PhotoFailurePhase =
  | 'initialization'
  | 'decode'
  | 'encode'
  | 'staging'
  | 'retention'
  | 'verification'
  | 'resolve'
  | 'cancellation'
  | 'cleanup';

export type PhotoError = {
  phase: PhotoFailurePhase;
  code: string;
  message: string;
  context?: Readonly<Record<string, string | number>>;
  cause?: unknown;
};

export type PhotoCleanupOperation =
  | 'clear-staging'
  | 'delete-encoded-output'
  | 'delete-staged-output';

export type PhotoCleanupIssue = {
  operation: PhotoCleanupOperation;
  message: string;
  cause?: unknown;
};

export type PreparePhotoResult =
  | { status: 'prepared'; photo: PreparedPhoto }
  | {
      status: 'cancelled';
      preparation: FailedPhoto;
      cleanupIssues: readonly PhotoCleanupIssue[];
    }
  | { status: 'failed'; preparation: FailedPhoto };

export type RetainPhotoResult =
  | { status: 'retained'; photo: RetainedPhoto }
  | { status: 'failed'; preparation: FailedPhoto };

export type DiscardPhotoResult =
  | { status: 'discarded'; photo: DiscardedPhoto }
  | { status: 'retained'; photo: RetainedPhoto }
  | { status: 'failed'; preparation: FailedPhoto };

export type PhotoUnavailableReason =
  | 'missing'
  | 'invalid-key'
  | 'unreadable'
  | 'unsupported-platform';

export type PhotoAvailability =
  | { status: 'absent' }
  | {
      status: 'available';
      photoKey: PhotoKey;
      uri: string;
    }
  | {
      status: 'unavailable';
      photoKey: string;
      reason: PhotoUnavailableReason;
      message: string;
      error?: PhotoError;
    };

export type PhotoFileStat = {
  uri: string;
  bytes: number;
};

export type PhotoStagingFile = {
  kind: 'staging';
  preparationId: PhotoPreparationId;
  uri: string;
};

export type PhotoRetainedFile = {
  kind: 'retained';
  photoKey: PhotoKey;
  uri: string;
};

export interface PhotoFileAdapter {
  initialize(): Promise<void>;
  createStagingFile(preparationId: PhotoPreparationId): PhotoStagingFile;
  createRetainedFile(photoKey: PhotoKey): PhotoRetainedFile;
  copyIntoStaging(sourceUri: string, destination: PhotoStagingFile): Promise<void>;
  promote(
    source: PhotoStagingFile,
    destination: PhotoRetainedFile
  ): Promise<void>;
  inspect(uri: string): Promise<PhotoFileStat | null>;
  deleteStaging(file: PhotoStagingFile): Promise<void>;
  resolve(photoKey: PhotoKey): Promise<PhotoFileStat | null>;
}

export type PhotoEncodedOutput = {
  uri: string;
  dimensions: PhotoDimensions;
};

export interface PhotoEncoder {
  readDimensions(sourceUri: string): Promise<PhotoDimensions>;
  encode(
    sourceUri: string,
    attempt: PhotoEncodingAttemptInput
  ): Promise<PhotoEncodedOutput>;
  release(output: PhotoEncodedOutput): Promise<void>;
}

export type PhotoEncodingAttemptInput = {
  attempt: number;
  maxLongEdge: number;
  quality: number;
  dimensions: PhotoDimensions;
};

export type PhotoKeyFactory = () => PhotoKey;
