/**
 * Pure policy for bounded capture-image processing.
 *
 * Each attempt starts from the decoded source dimensions. The policy uses a
 * finite list so capture latency has a predictable upper bound, then keeps the
 * smallest readable output when the approximate byte target is not reached.
 */
import type {
  PhotoDimensions,
  PhotoMetrics,
} from './photo-contract';

export const PHOTO_TARGET_BYTES = 200_000;

export const PHOTO_ENCODING_ATTEMPTS = [
  { attempt: 1, maxLongEdge: 1_600, quality: 0.75 },
  { attempt: 2, maxLongEdge: 1_600, quality: 0.6 },
  { attempt: 3, maxLongEdge: 1_280, quality: 0.6 },
] as const;

export type PhotoEncodingAttempt = (typeof PHOTO_ENCODING_ATTEMPTS)[number];

export type PlannedPhotoEncodingAttempt = PhotoEncodingAttempt & {
  dimensions: PhotoDimensions;
};

export type EncodedPhotoCandidate = PhotoMetrics & {
  uri: string;
};

function isValidDimension(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function assertDimensions(dimensions: PhotoDimensions, label: string): void {
  if (!isValidDimension(dimensions.width) || !isValidDimension(dimensions.height)) {
    throw new RangeError(`${label} must contain positive integer dimensions`);
  }
}

/** Resize to the requested long edge without enlarging a smaller source. */
export function resizePhotoDimensions(
  dimensions: PhotoDimensions,
  maxLongEdge: number
): PhotoDimensions {
  assertDimensions(dimensions, 'photo dimensions');
  if (!isValidDimension(maxLongEdge)) {
    throw new RangeError('maxLongEdge must be a positive integer');
  }

  const currentLongEdge = Math.max(dimensions.width, dimensions.height);
  if (currentLongEdge <= maxLongEdge) {
    return { ...dimensions };
  }

  const scale = maxLongEdge / currentLongEdge;
  const width = Math.max(1, Math.round(dimensions.width * scale));
  const height = Math.max(1, Math.round(dimensions.height * scale));
  return { width, height };
}

export function planPhotoEncoding(
  originalDimensions: PhotoDimensions
): readonly PlannedPhotoEncodingAttempt[] {
  assertDimensions(originalDimensions, 'original photo dimensions');
  return PHOTO_ENCODING_ATTEMPTS.map((attempt) => ({
    ...attempt,
    dimensions: resizePhotoDimensions(
      originalDimensions,
      attempt.maxLongEdge
    ),
  }));
}

function assertCandidate(candidate: EncodedPhotoCandidate): void {
  if (
    !Number.isSafeInteger(candidate.bytes) ||
    candidate.bytes <= 0 ||
    !isValidDimension(candidate.outputDimensions.width) ||
    !isValidDimension(candidate.outputDimensions.height) ||
    !Number.isSafeInteger(candidate.attempt) ||
    candidate.attempt <= 0 ||
    candidate.uri.length === 0
  ) {
    throw new RangeError('encoded photo candidate metadata is invalid');
  }
  assertDimensions(candidate.originalDimensions, 'original photo dimensions');
  if (!Number.isFinite(candidate.elapsedMs) || candidate.elapsedMs < 0) {
    throw new RangeError('encoded photo elapsed time is invalid');
  }
}

/**
 * Select the first in-policy candidate at or below the target. If none meets
 * it, choose the smallest valid output and use attempt order as the tie-break.
 */
export function selectPhotoCandidate(
  candidates: readonly EncodedPhotoCandidate[],
  targetBytes: number = PHOTO_TARGET_BYTES
): EncodedPhotoCandidate {
  if (!Number.isSafeInteger(targetBytes) || targetBytes <= 0) {
    throw new RangeError('photo target bytes must be a positive integer');
  }
  if (candidates.length === 0) {
    throw new RangeError('at least one encoded photo candidate is required');
  }
  candidates.forEach(assertCandidate);

  const inTarget = [...candidates]
    .filter((candidate) => candidate.bytes <= targetBytes)
    .sort((left, right) => left.attempt - right.attempt);
  if (inTarget.length > 0) {
    return inTarget[0];
  }

  return [...candidates].sort(
    (left, right) => left.bytes - right.bytes || left.attempt - right.attempt
  )[0];
}

