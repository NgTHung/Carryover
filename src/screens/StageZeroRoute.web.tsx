import { StageZeroScreen } from '../dev/StageZeroScreen';

export default function StageZeroRoute() {
  return (
    <StageZeroScreen previewNotice="Browser preview. The ledger and iOS widget are not connected." />
  );
}
