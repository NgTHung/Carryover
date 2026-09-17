import type {
  DraftNudgeAdapter,
  DraftNudgePermission,
  DraftNudgeSchedule,
  DraftNudgeScheduledRequest,
} from '../../src/notifications/draft-nudge-contract';
import { DRAFT_NUDGE_SCHEDULE } from '../../src/notifications/draft-nudge-policy';

export function scheduledDraftNudgeRequest(
  schedule: DraftNudgeSchedule = DRAFT_NUDGE_SCHEDULE,
  identifier = schedule.identifier
): DraftNudgeScheduledRequest {
  return {
    identifier,
    content: {
      title: schedule.title,
      body: schedule.body,
      data: schedule.data,
      sound: 'none',
      badge: null,
    },
    trigger: {
      kind: 'daily',
      repeats: true,
      hour: schedule.trigger.hour,
      minute: schedule.trigger.minute,
    },
  };
}

export type FakeDraftNudgeAdapter = {
  adapter: DraftNudgeAdapter;
  requests: DraftNudgeScheduledRequest[];
  calls: string[];
  setPermission: (permission: DraftNudgePermission) => void;
  setScheduleFailure: (failed: boolean) => void;
  setCancellationFailure: (failed: boolean) => void;
};

export function createFakeDraftNudgeAdapter(
  initialPermission: DraftNudgePermission = { status: 'allowed', quiet: false },
  initialRequests: DraftNudgeScheduledRequest[] = []
): FakeDraftNudgeAdapter {
  let permission = initialPermission;
  let scheduleFailure = false;
  let cancellationFailure = false;
  const requests = [...initialRequests];
  const calls: string[] = [];
  const adapter: DraftNudgeAdapter = {
    inspectPermission: async () => permission,
    requestPermission: async () => permission,
    listScheduled: async () => requests.slice(),
    scheduleDailyNudge: async (schedule) => {
      calls.push('schedule');
      const request = scheduledDraftNudgeRequest(schedule);
      if (!scheduleFailure) requests.push(request);
      if (scheduleFailure) throw new Error('schedule unavailable');
      return request.identifier;
    },
    cancelScheduled: async (identifier) => {
      calls.push(`cancel:${identifier}`);
      if (cancellationFailure) throw new Error(`cancel unavailable for ${identifier}`);
      const index = requests.findIndex((request) => request.identifier === identifier);
      if (index >= 0) requests.splice(index, 1);
    },
    subscribeToResponses: () => () => undefined,
    readLastResponse: () => null,
    clearLastResponse: () => undefined,
    dismissOwnedDelivered: async () => {
      calls.push('dismiss-delivered');
    },
    configureForegroundPresentation: () => undefined,
  };

  return {
    adapter,
    requests,
    calls,
    setPermission: (next) => {
      permission = next;
    },
    setScheduleFailure: (failed) => {
      scheduleFailure = failed;
    },
    setCancellationFailure: (failed) => {
      cancellationFailure = failed;
    },
  };
}
