/**
 * Local UI preview entry point.
 *
 * Browser storage is not evidence about the native ledger, so this surface
 * renders the shared stage 0 layout and leaves SQLite to device and database tests.
 */
import { StageZeroScreen } from './src/dev/StageZeroScreen';

export default function App() {
  return (
    <StageZeroScreen previewNotice="Browser preview. The ledger and iOS widget are not connected." />
  );
}
