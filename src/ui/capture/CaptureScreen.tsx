/**
 * Renders one photo-first capture attempt with injected native and data edges.
 *
 * The controller owns the route-local asynchronous work so this module stays
 * focused on wiring the state to the shared capture view.
 */
import { CaptureView } from './CaptureView';
import type { CaptureScreenProps } from './capture-contract';
import { useCaptureController } from './useCaptureController';

export type {
  CaptureCamera,
  CapturePermission,
  CapturePhotoAccess,
  CaptureScreenProps,
} from './capture-contract';

export function CaptureScreen(props: CaptureScreenProps) {
  const controller = useCaptureController(props);
  return (
    <CaptureView
      {...controller}
      permission={props.permission}
      camera={props.camera}
      isFocused={props.isFocused}
      isAppActive={props.isAppActive}
    />
  );
}
