/**
 * Defines the one reminder this feature owns and calculates its desired OS
 * state from authoritative eligibility, permission, and pending requests.
 *
 * The stable identifier and marker let recovery remove duplicates without
 * touching unrelated notifications. A daily input is normalized separately
 * by the adapter because iOS reports it as a calendar trigger.
 */
import type {
  DraftNudgePermission,
  DraftNudgePayload,
  DraftNudgeSchedule,
  DraftNudgeScheduledRequest,
} from './draft-nudge-contract';

export const DRAFT_NUDGE_IDENTIFIER = 'carryover.unknown-drafts.daily.v1';
export const DRAFT_NUDGE_KIND = 'carryover-unknown-drafts';
export const DRAFT_NUDGE_VERSION = 1;
export const DRAFT_NUDGE_ROUTE = '/drafts' as const;
export const DRAFT_NUDGE_HOUR = 20;
export const DRAFT_NUDGE_MINUTE = 0;
export const DRAFT_NUDGE_TITLE = 'Complete your drafts';
export const DRAFT_NUDGE_BODY = 'Open Drafts to add unknown amounts';
export const DRAFT_NUDGE_DEFAULT_ACTION_IDENTIFIER =
  'expo.modules.notifications.actions.DEFAULT';

export const DRAFT_NUDGE_PAYLOAD: DraftNudgePayload = {
  kind: DRAFT_NUDGE_KIND,
  version: DRAFT_NUDGE_VERSION,
  route: DRAFT_NUDGE_ROUTE,
};

export const DRAFT_NUDGE_SCHEDULE: DraftNudgeSchedule = {
  identifier: DRAFT_NUDGE_IDENTIFIER,
  title: DRAFT_NUDGE_TITLE,
  body: DRAFT_NUDGE_BODY,
  data: DRAFT_NUDGE_PAYLOAD,
  trigger: {
    kind: 'daily',
    hour: DRAFT_NUDGE_HOUR,
    minute: DRAFT_NUDGE_MINUTE,
  },
};

export type DraftNudgePlan =
  | {
      action: 'cancel';
      reason: 'no-unknowns' | 'permission-off' | 'permission-unavailable';
      cancel: DraftNudgeScheduledRequest[];
      cleanupDelivered: boolean;
    }
  | {
      action: 'keep';
      keep: DraftNudgeScheduledRequest;
      cancel: DraftNudgeScheduledRequest[];
      cleanupDelivered: false;
    }
  | {
      action: 'cancel-and-schedule';
      cancel: DraftNudgeScheduledRequest[];
      schedule: DraftNudgeSchedule;
      cleanupDelivered: false;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isOwnedDraftNudgeData(
  identifier: string,
  data: unknown
): boolean {
  if (identifier === DRAFT_NUDGE_IDENTIFIER) return true;
  if (!isRecord(data)) return false;
  return (
    data.kind === DRAFT_NUDGE_KIND &&
    data.version === DRAFT_NUDGE_VERSION &&
    data.route === DRAFT_NUDGE_ROUTE
  );
}

export function isValidDraftNudgePayload(data: unknown): data is DraftNudgePayload {
  if (!isRecord(data)) return false;
  return (
    data.kind === DRAFT_NUDGE_PAYLOAD.kind &&
    data.version === DRAFT_NUDGE_PAYLOAD.version &&
    data.route === DRAFT_NUDGE_PAYLOAD.route
  );
}

export function isMatchingDraftNudgeRequest(
  request: DraftNudgeScheduledRequest
): boolean {
  return (
    request.identifier === DRAFT_NUDGE_SCHEDULE.identifier &&
    request.content.title === DRAFT_NUDGE_SCHEDULE.title &&
    request.content.body === DRAFT_NUDGE_SCHEDULE.body &&
    isValidDraftNudgePayload(request.content.data) &&
    request.content.sound === 'none' &&
    request.content.badge === null &&
    request.trigger.kind === 'daily' &&
    request.trigger.repeats &&
    request.trigger.hour === DRAFT_NUDGE_HOUR &&
    request.trigger.minute === DRAFT_NUDGE_MINUTE
  );
}

function ownedRequests(
  scheduled: DraftNudgeScheduledRequest[]
): DraftNudgeScheduledRequest[] {
  return scheduled
    .filter((request) => isOwnedDraftNudgeData(request.identifier, request.content.data))
    .sort((left, right) => left.identifier.localeCompare(right.identifier));
}

export function calculateDraftNudgePlan(input: {
  hasUnknownDrafts: boolean;
  permission: DraftNudgePermission;
  scheduled: DraftNudgeScheduledRequest[];
}): DraftNudgePlan {
  const owned = ownedRequests(input.scheduled);

  if (!input.hasUnknownDrafts) {
    return {
      action: 'cancel',
      reason: 'no-unknowns',
      cancel: owned,
      cleanupDelivered: true,
    };
  }

  if (input.permission.status !== 'allowed') {
    return {
      action: 'cancel',
      reason:
        input.permission.status === 'unavailable'
          ? 'permission-unavailable'
          : 'permission-off',
      cancel: owned,
      cleanupDelivered: false,
    };
  }

  const canonical = owned.find(isMatchingDraftNudgeRequest);
  if (canonical !== undefined) {
    return {
      action: 'keep',
      keep: canonical,
      cancel: owned.filter((request) => request !== canonical),
      cleanupDelivered: false,
    };
  }

  return {
    action: 'cancel-and-schedule',
    cancel: owned,
    schedule: DRAFT_NUDGE_SCHEDULE,
    cleanupDelivered: false,
  };
}
