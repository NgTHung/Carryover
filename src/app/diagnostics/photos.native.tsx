import { Redirect } from 'expo-router';
import Constants from 'expo-constants';

import {
  discardPreparedPhoto,
  preparePhoto,
  resolvePhoto,
  retainPhoto,
} from '../../photos/photo-access';
import { PhotoProbeScreen } from '../../ui/diagnostics/PhotoProbeScreen';
import {
  loadPhotoProbeFixture,
  PHOTO_PROBE_FIXTURES,
} from '../../diagnostics/photos/photo-fixtures';
import { isPhotoProbeEnabled } from '../../diagnostics/photos/photo-probe-gate';
import {
  readPhotoProbeState,
  writePhotoProbeState,
} from '../../diagnostics/photos/photo-probe-storage';

export default function PhotoDiagnosticsRoute() {
  if (!isPhotoProbeEnabled(Constants.expoConfig?.extra?.carryoverVariant)) {
    return <Redirect href="/" />;
  }

  return (
    <PhotoProbeScreen
      access={{
        preparePhoto,
        retainPhoto,
        discardPreparedPhoto,
        resolvePhoto,
      }}
      fixtures={PHOTO_PROBE_FIXTURES}
      loadFixture={loadPhotoProbeFixture}
      readSavedKeys={readPhotoProbeState}
      writeSavedKeys={writePhotoProbeState}
    />
  );
}
