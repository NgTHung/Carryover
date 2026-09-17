/** Browser fallback for the native process-level reminder service. */
import { notificationAdapter } from './notification-adapter';
import {
  createDraftNudgeService,
  type DraftNudgeService,
} from './draft-nudge-service';

const draftNudgeService = createDraftNudgeService({
  readHasUnknownDrafts: async () => {
    throw new Error('The browser preview does not open the ledger.');
  },
  adapter: notificationAdapter,
});

export function getDraftNudgeService(): DraftNudgeService {
  return draftNudgeService;
}

export function startDraftNudgeService(): () => void {
  return () => undefined;
}
