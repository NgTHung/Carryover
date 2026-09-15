/**
 * Resolves a persisted photo key into a transient display URI.
 *
 * A key is validated before it reaches the filesystem adapter. Missing files
 * and read failures stay visible as different unavailable states so a ledger
 * row can remain intact while its photo is repaired or restored.
 */
import {
  photoKeySchema,
  type PhotoAvailability,
  type PhotoFileAdapter,
} from './photo-contract';
import { errorMessage, photoError } from './photo-store-support';

export async function resolvePhoto(
  files: PhotoFileAdapter,
  photoKey: string | null
): Promise<PhotoAvailability> {
  if (photoKey === null) {
    return { status: 'absent' };
  }

  const parsed = photoKeySchema.safeParse(photoKey);
  if (!parsed.success) {
    return {
      status: 'unavailable',
      photoKey,
      reason: 'invalid-key',
      message: 'Photo key is not a supported retained-photo key',
    };
  }

  try {
    const stat = await files.resolve(parsed.data);
    if (stat === null) {
      return {
        status: 'unavailable',
        photoKey,
        reason: 'missing',
        message: 'Retained photo file is missing',
      };
    }
    if (!Number.isSafeInteger(stat.bytes) || stat.bytes <= 0) {
      return {
        status: 'unavailable',
        photoKey,
        reason: 'unreadable',
        message: 'Retained photo file is empty or has an invalid size',
      };
    }
    return { status: 'available', photoKey: parsed.data, uri: stat.uri };
  } catch (error) {
    return {
      status: 'unavailable',
      photoKey,
      reason: 'unreadable',
      message: errorMessage(error),
      error: photoError('resolve', 'photo-resolution-failed', error, { photoKey }),
    };
  }
}
