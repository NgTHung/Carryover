/**
 * Composes the one process-level reminder service for the native app.
 *
 * The service is reused across development remounts. Only this boundary
 * connects it to the ledger notifier and React Native app lifecycle; routes
 * receive the existing service instance instead of creating schedulers.
 */
import { AppState } from 'react-native';

import type { LedgerChange } from '../data/ledger-change-notifier';
import {
  getDraftNudgeData,
  subscribeLedgerChanges,
} from '../ui/ledger-access';
import { notificationAdapter } from './notification-adapter';
import {
  createDraftNudgeService,
  type DraftNudgeService,
} from './draft-nudge-service';

const draftNudgeService = createDraftNudgeService({
  readHasUnknownDrafts: () => getDraftNudgeData().hasUnknownDrafts(),
  adapter: notificationAdapter,
});

export function getDraftNudgeService(): DraftNudgeService {
  return draftNudgeService;
}

function subscribeToTransactionChanges(listener: () => void): () => void {
  return subscribeLedgerChanges((change: LedgerChange) => {
    if (change.table === 'transactions') listener();
  });
}

export function startDraftNudgeService(): () => void {
  return draftNudgeService.start({
    subscribeToLedger: subscribeToTransactionChanges,
    appState: AppState,
  });
}
