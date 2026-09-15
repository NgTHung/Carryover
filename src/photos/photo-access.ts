/**
 * Native public photo access.
 *
 * The factory is kept at this platform edge so shared UI can depend on the
 * photo contract without importing native filesystem or image modules.
 */
import { randomUUID } from 'expo-crypto';

import { createPhotoEncoder } from './photo-encoder';
import { createPhotoFileAdapter } from './photo-files';
import { parsePhotoKey } from './photo-contract';
import { createPhotoStore } from './photo-store';

const photoStore = createPhotoStore({
  files: createPhotoFileAdapter(),
  encoder: createPhotoEncoder(),
  keyFactory: () =>
    parsePhotoKey(`photos/v1/${randomUUID().toLowerCase()}.jpg`),
});

export const preparePhoto = photoStore.preparePhoto;
export const retainPhoto = photoStore.retainPhoto;
export const discardPreparedPhoto = photoStore.discardPreparedPhoto;
export const resolvePhoto = photoStore.resolvePhoto;

