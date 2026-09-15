/**
 * Expo ImageManipulator adapter for capture photos.
 *
 * ImageManipulator writes encoded results to its cache. The photo store owns
 * those generated outputs through `release`; the caller's source URI is never
 * deleted or moved.
 */
import {
  ImageManipulator,
  SaveFormat,
  type ImageRef,
} from 'expo-image-manipulator';
import { File } from 'expo-file-system';

import type {
  PhotoDimensions,
  PhotoEncodedOutput,
  PhotoEncoder,
  PhotoEncodingAttemptInput,
} from './photo-contract';

function assertDimensions(dimensions: PhotoDimensions, label: string): void {
  if (
    !Number.isSafeInteger(dimensions.width) ||
    dimensions.width <= 0 ||
    !Number.isSafeInteger(dimensions.height) ||
    dimensions.height <= 0
  ) {
    throw new RangeError(`${label} contains invalid dimensions`);
  }
}

function assertOutput(output: PhotoEncodedOutput): PhotoEncodedOutput {
  if (output.uri.length === 0) {
    throw new Error('ImageManipulator returned an empty output URI');
  }
  assertDimensions(output.dimensions, 'encoded photo');
  return output;
}

export function createPhotoEncoder(): PhotoEncoder {
  const ownedOutputs = new Set<string>();

  return {
    async readDimensions(sourceUri: string): Promise<PhotoDimensions> {
      const context = ImageManipulator.manipulate(sourceUri);
      let image: ImageRef | undefined;
      try {
        image = await context.renderAsync();
        const dimensions = { width: image.width, height: image.height };
        assertDimensions(dimensions, 'source photo');
        return dimensions;
      } finally {
        image?.release();
        context.release();
      }
    },

    async encode(
      sourceUri: string,
      attempt: PhotoEncodingAttemptInput
    ): Promise<PhotoEncodedOutput> {
      assertDimensions(attempt.dimensions, 'planned photo');
      if (!Number.isFinite(attempt.quality) || attempt.quality < 0 || attempt.quality > 1) {
        throw new RangeError('photo quality must be between zero and one');
      }

      const context = ImageManipulator
        .manipulate(sourceUri)
        .resize({
          width: attempt.dimensions.width,
          height: attempt.dimensions.height,
      });
      let image: ImageRef | undefined;
      try {
        image = await context.renderAsync();
        const saved = await image.saveAsync({
          format: SaveFormat.JPEG,
          compress: attempt.quality,
          base64: false,
        });
        const output = assertOutput({
          uri: saved.uri,
          dimensions: { width: saved.width, height: saved.height },
        });
        ownedOutputs.add(output.uri);
        return output;
      } finally {
        image?.release();
        context.release();
      }
    },

    async release(output: PhotoEncodedOutput): Promise<void> {
      if (!ownedOutputs.has(output.uri)) {
        return;
      }
      const file = new File(output.uri);
      if (file.exists) {
        file.delete();
      }
      ownedOutputs.delete(output.uri);
    },
  };
}
