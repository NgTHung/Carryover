import { Redirect } from 'expo-router';

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
} from './photo-fixtures';
import { isPhotoProbeEnabled } from './photo-probe-gate';
import {
  readPhotoProbeState,
  writePhotoProbeState,
} from './photo-probe-storage';

export default function PhotoDiagnosticsRoute() {
  if (!isPhotoProbeEnabled(process.env.CARRYOVER_VARIANT)) {
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
