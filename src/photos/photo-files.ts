/**
 * Native file operations for capture photos.
 *
 * The document directory is resolved inside each operation because Expo may
 * recreate the app container between launches. Staging and retained files use
 * separate paths, and only references derived from the validated key can be
 * promoted or resolved.
 */
import { Directory, File, Paths } from 'expo-file-system';

import {
  parsePhotoKey,
  type PhotoFileAdapter,
  type PhotoFileStat,
  type PhotoKey,
  type PhotoRetainedFile,
  type PhotoStagingFile,
} from './photo-contract';

const STAGING_DIRECTORY = 'capture-staging';
const PHOTO_DIRECTORY = 'photos';
const PHOTO_VERSION_DIRECTORY = 'v1';
const PHOTO_KEY_PREFIX = `${PHOTO_DIRECTORY}/${PHOTO_VERSION_DIRECTORY}/`;
const PHOTO_KEY_SUFFIX = '.jpg';

function documentDirectory(): Directory {
  return new Directory(Paths.document);
}

function stagingDirectory(): Directory {
  return new Directory(documentDirectory(), STAGING_DIRECTORY);
}

function retainedDirectory(): Directory {
  return new Directory(
    documentDirectory(),
    PHOTO_DIRECTORY,
    PHOTO_VERSION_DIRECTORY
  );
}

function keyFileName(photoKey: PhotoKey): string {
  const parsed = parsePhotoKey(photoKey);
  return parsed.slice(PHOTO_KEY_PREFIX.length, -PHOTO_KEY_SUFFIX.length) + PHOTO_KEY_SUFFIX;
}

function assertPreparationId(preparationId: string): void {
  if (!/^[a-z0-9-]+(?![\s\S])/.test(preparationId)) {
    throw new TypeError('photo preparation id contains an unsafe path character');
  }
}

function expectedStagingFile(preparationId: string): File {
  assertPreparationId(preparationId);
  return new File(stagingDirectory(), `${preparationId}.jpg`);
}

function expectedRetainedFile(photoKey: PhotoKey): File {
  return new File(retainedDirectory(), keyFileName(photoKey));
}

function assertStagingReference(reference: PhotoStagingFile): File {
  const expected = expectedStagingFile(reference.preparationId);
  if (reference.kind !== 'staging' || reference.uri !== expected.uri) {
    throw new TypeError('photo staging reference is not owned by this adapter');
  }
  return expected;
}

function assertRetainedReference(reference: PhotoRetainedFile): File {
  const expected = expectedRetainedFile(reference.photoKey);
  if (reference.kind !== 'retained' || reference.uri !== expected.uri) {
    throw new TypeError('photo retained reference is not owned by this adapter');
  }
  return expected;
}

function statFromInfo(file: File): PhotoFileStat | null {
  const info = file.info();
  if (!info.exists) {
    return null;
  }
  if (info.size === undefined || !Number.isSafeInteger(info.size) || info.size < 0) {
    throw new Error(`Photo file size is unavailable for ${file.uri}`);
  }
  return { uri: file.uri, bytes: info.size };
}

export function createPhotoFileAdapter(): PhotoFileAdapter {
  return {
    async initialize(): Promise<void> {
      const staging = stagingDirectory();
      if (staging.exists) {
        staging.delete();
      }
      staging.create({ intermediates: true, idempotent: true });
    },

    createStagingFile(preparationId: string): PhotoStagingFile {
      return {
        kind: 'staging',
        preparationId,
        uri: expectedStagingFile(preparationId).uri,
      };
    },

    createRetainedFile(photoKey: PhotoKey): PhotoRetainedFile {
      return {
        kind: 'retained',
        photoKey: parsePhotoKey(photoKey),
        uri: expectedRetainedFile(photoKey).uri,
      };
    },

    async copyIntoStaging(
      sourceUri: string,
      destination: PhotoStagingFile
    ): Promise<void> {
      const destinationFile = assertStagingReference(destination);
      await new File(sourceUri).copy(destinationFile, { overwrite: false });
    },

    async promote(
      source: PhotoStagingFile,
      destination: PhotoRetainedFile
    ): Promise<void> {
      const sourceFile = assertStagingReference(source);
      const destinationFile = assertRetainedReference(destination);
      retainedDirectory().create({ intermediates: true, idempotent: true });
      await sourceFile.move(destinationFile, { overwrite: false });
    },

    async inspect(uri: string): Promise<PhotoFileStat | null> {
      return statFromInfo(new File(uri));
    },

    async deleteStaging(file: PhotoStagingFile): Promise<void> {
      const stagingFile = assertStagingReference(file);
      if (stagingFile.exists) {
        stagingFile.delete();
      }
    },

    async resolve(photoKey: PhotoKey): Promise<PhotoFileStat | null> {
      return statFromInfo(expectedRetainedFile(parsePhotoKey(photoKey)));
    },
  };
}
