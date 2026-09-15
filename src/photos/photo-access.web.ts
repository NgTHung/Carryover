/**
 * Explicit browser boundary for photo access.
 *
 * The web preview has no durable native photo store, so it returns an
 * unavailable state instead of importing or pretending to run native APIs.
 */
import { createUnsupportedPhotoAccess } from './photo-unsupported';

const photoStore = createUnsupportedPhotoAccess();

export const preparePhoto = photoStore.preparePhoto;
export const retainPhoto = photoStore.retainPhoto;
export const discardPreparedPhoto = photoStore.discardPreparedPhoto;
export const resolvePhoto = photoStore.resolvePhoto;
