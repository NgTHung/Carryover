/** Browser fallback for the native-only local notification adapter. */
import type { DraftNudgeAdapter } from './draft-nudge-contract';

const message = 'Local notifications are unavailable in the browser preview.';

export const notificationAdapter: DraftNudgeAdapter = {
  inspectPermission: async () => ({ status: 'unavailable', message }),
  requestPermission: async () => ({ status: 'unavailable', message }),
  listScheduled: async () => {
    throw new Error(message);
  },
  scheduleDailyNudge: async () => {
    throw new Error(message);
  },
  cancelScheduled: async () => {
    throw new Error(message);
  },
  subscribeToResponses: () => () => undefined,
  readLastResponse: () => null,
  clearLastResponse: () => undefined,
  dismissOwnedDelivered: async () => undefined,
  configureForegroundPresentation: () => undefined,
};
