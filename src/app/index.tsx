import { randomUUID } from 'expo-crypto';
import { router, type Href } from 'expo-router';

import { currentPeriod } from '../data/period';
import {
  selectSnapshotState,
  useSnapshotStore,
} from '../budget/snapshot-store';
import { HomeSnapshotView } from '../ui/home/HomeSnapshotView';
import { retryBudgetSnapshot } from '../ui/ledger-access';

export default function HomeRoute({
  now = () => new Date(),
}: {
  now?: () => Date;
} = {}) {
  const state = useSnapshotStore(selectSnapshotState);

  return (
    <HomeSnapshotView
      state={state}
      onRetry={retryBudgetSnapshot}
      onChangeHorizon={() =>
        router.push(`/horizon?period=${currentPeriod(now())}` as Href)
      }
      onCapture={() =>
        router.push(`/capture/${randomUUID().toLowerCase()}` as Href)
      }
    />
  );
}
