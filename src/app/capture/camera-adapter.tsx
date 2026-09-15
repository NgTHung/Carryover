/**
 * Native camera edge for the reusable capture screen.
 *
 * Expo Camera stays in this adapter. The capture screen receives only a
 * preview renderer and a still-image operation, which keeps component tests
 * independent from native camera permissions and hardware.
 */
import { CameraView } from 'expo-camera';
import { useCallback, useMemo, useRef, type ReactNode } from 'react';

import type { CaptureCamera } from '../../ui/capture/capture-contract';

export function useNativeCaptureCamera(): CaptureCamera {
  const cameraRef = useRef<CameraView>(null);

  const renderPreview = useCallback(
    (props: Parameters<CaptureCamera['renderPreview']>[0]): ReactNode => (
      <CameraView
        ref={cameraRef}
        active={props.active}
        facing="back"
        mode="picture"
        mute
        animateShutter={false}
        onCameraReady={props.onReady}
        onMountError={(event) => props.onError(event.message)}
        className="flex-1"
      />
    ),
    []
  );

  const takePicture = useCallback(async () => {
    const camera = cameraRef.current;
    if (camera === null) return undefined;
    const picture = await camera.takePictureAsync({
      base64: false,
      exif: false,
    });
    return picture.uri === '' ? undefined : { uri: picture.uri };
  }, []);

  return useMemo(() => ({ renderPreview, takePicture }), [renderPreview, takePicture]);
}
