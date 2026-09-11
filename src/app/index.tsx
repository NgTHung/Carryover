import {
  selectSnapshotState,
  useSnapshotStore,
} from '../budget/snapshot-store';
import { HomeSnapshotView } from '../ui/home/HomeSnapshotView';
import { retryBudgetSnapshot } from '../ui/ledger-access';

export default function HomeRoute() {
  const state = useSnapshotStore(selectSnapshotState);

  return <HomeSnapshotView state={state} onRetry={retryBudgetSnapshot} />;
}
