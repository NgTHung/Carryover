import { FIXTURE_SNAPSHOT } from '../budget/snapshot';
import { HomeSnapshotView } from '../ui/home/HomeSnapshotView';

export default function HomeWebRoute() {
  return (
    <HomeSnapshotView
      state={{ status: 'ready', snapshot: FIXTURE_SNAPSHOT }}
      previewNotice="Browser preview. The ledger and iOS widget are not connected."
    />
  );
}
