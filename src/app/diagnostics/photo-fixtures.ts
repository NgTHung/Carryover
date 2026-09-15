import { Asset } from 'expo-asset';

import type { PhotoProbeFixture } from './photo-probe-contract';

import alreadySmall from '../../../assets/photo-fixtures/already-small.png';
import darkNoisy from '../../../assets/photo-fixtures/dark-noisy.png';
import detailedScene from '../../../assets/photo-fixtures/detailed-scene.png';
import landscapePurchase from '../../../assets/photo-fixtures/landscape-purchase.png';
import portraitReceipt from '../../../assets/photo-fixtures/portrait-receipt.png';
import rotatedOrientation from '../../../assets/photo-fixtures/rotated-orientation.jpg';
import supportedHeic from '../../../assets/photo-fixtures/supported-heic.heic';

export const PHOTO_PROBE_FIXTURES = [
  {
    id: 'portrait-receipt',
    label: 'Portrait receipt',
    description: 'Tall receipt with small text and repeated rows',
    sourceType: 'png',
    assetModule: portraitReceipt,
  },
  {
    id: 'landscape-purchase',
    label: 'Landscape purchase',
    description: 'Wide, brightly coloured purchase scene',
    sourceType: 'png',
    assetModule: landscapePurchase,
  },
  {
    id: 'dark-noisy',
    label: 'Dark and noisy',
    description: 'Low-light image with sensor-like texture',
    sourceType: 'png',
    assetModule: darkNoisy,
  },
  {
    id: 'detailed-scene',
    label: 'Detailed scene',
    description: 'Large scene with edges and colour blocks',
    sourceType: 'png',
    assetModule: detailedScene,
  },
  {
    id: 'already-small',
    label: 'Already small',
    description: 'Small source that must not be upscaled',
    sourceType: 'png',
    assetModule: alreadySmall,
  },
  {
    id: 'rotated-orientation',
    label: 'Rotated JPEG',
    description: 'JPEG with EXIF orientation 6',
    sourceType: 'jpeg',
    assetModule: rotatedOrientation,
  },
  {
    id: 'supported-heic',
    label: 'HEIC source',
    description: 'Small HEIF image for native decoder coverage',
    sourceType: 'heic',
    assetModule: supportedHeic,
  },
] as const;

export type PhotoProbeAssetFixture = (typeof PHOTO_PROBE_FIXTURES)[number];

export async function loadPhotoProbeFixture(
  fixture: PhotoProbeAssetFixture
): Promise<string> {
  const [asset] = await Asset.loadAsync(fixture.assetModule);
  if (asset === undefined || asset.localUri === null) {
    throw new Error(`Bundled fixture did not resolve locally: ${fixture.id}`);
  }
  return asset.localUri;
}
