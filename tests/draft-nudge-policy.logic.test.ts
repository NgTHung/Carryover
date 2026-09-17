import type {
  DraftNudgePermission,
  DraftNudgeScheduledRequest,
} from '../src/notifications/draft-nudge-contract';
import {
  calculateDraftNudgePlan,
  DRAFT_NUDGE_BODY,
  DRAFT_NUDGE_IDENTIFIER,
  DRAFT_NUDGE_PAYLOAD,
  DRAFT_NUDGE_SCHEDULE,
  DRAFT_NUDGE_TITLE,
  isMatchingDraftNudgeRequest,
  isOwnedDraftNudgeData,
} from '../src/notifications/draft-nudge-policy';

function request(
  identifier: string,
  overrides: Partial<DraftNudgeScheduledRequest> = {}
): DraftNudgeScheduledRequest {
  return {
    identifier,
    content: {
      title: DRAFT_NUDGE_TITLE,
      body: DRAFT_NUDGE_BODY,
      data: DRAFT_NUDGE_PAYLOAD,
      sound: 'none',
      badge: null,
    },
    trigger: {
      kind: 'daily',
      repeats: true,
      hour: 20,
      minute: 0,
    },
    ...overrides,
  };
}

const allowed: DraftNudgePermission = { status: 'allowed', quiet: false };
const requestable: DraftNudgePermission = { status: 'requestable', canAskAgain: true };
const denied: DraftNudgePermission = { status: 'denied', canAskAgain: false };

test('cancels all owned requests and cleans delivered reminders once no unknowns remain', () => {
  const canonical = request(DRAFT_NUDGE_IDENTIFIER);
  const duplicate = request('legacy-duplicate');
  const unrelated = request('unrelated', { content: { ...canonical.content, data: { kind: 'other' } } });

  expect(calculateDraftNudgePlan({
    hasUnknownDrafts: false,
    permission: allowed,
    scheduled: [unrelated, duplicate, canonical],
  })).toEqual({
    action: 'cancel',
    reason: 'no-unknowns',
    cancel: [canonical, duplicate],
    cleanupDelivered: true,
  });
});

test.each([
  [requestable, 'permission-off'],
  [denied, 'permission-off'],
  [{ status: 'unavailable', message: 'permission failed' } as const, 'permission-unavailable'],
] as const)('cancels owned pending requests when permission is %s', (permission, reason) => {
  const first = request('z-duplicate');
  const second = request(DRAFT_NUDGE_IDENTIFIER);
  expect(calculateDraftNudgePlan({
    hasUnknownDrafts: true,
    permission,
    scheduled: [first, second],
  })).toMatchObject({
    action: 'cancel',
    reason,
    cancel: [second, first],
    cleanupDelivered: false,
  });
});

test('keeps exactly one matching canonical request and removes owned duplicates', () => {
  const canonical = request(DRAFT_NUDGE_IDENTIFIER);
  const duplicate = request('duplicate');
  const unrelated = request('unrelated', {
    content: { ...canonical.content, data: { kind: 'unrelated' } },
  });
  const plan = calculateDraftNudgePlan({
    hasUnknownDrafts: true,
    permission: allowed,
    scheduled: [duplicate, unrelated, canonical],
  });

  expect(plan).toEqual({
    action: 'keep',
    keep: canonical,
    cancel: [duplicate],
    cleanupDelivered: false,
  });
  expect(isMatchingDraftNudgeRequest(canonical)).toBe(true);
  expect(isOwnedDraftNudgeData('unrelated', unrelated.content.data)).toBe(false);
});

test('cancels obsolete owned requests before scheduling a canonical replacement', () => {
  const wrongCopy = request(DRAFT_NUDGE_IDENTIFIER, {
    content: {
      title: 'Old title',
      body: DRAFT_NUDGE_BODY,
      data: DRAFT_NUDGE_PAYLOAD,
      sound: 'none',
      badge: null,
    },
  });
  const wrongTime = request('duplicate', {
    trigger: { kind: 'daily', repeats: true, hour: 21, minute: 0 },
  });

  expect(calculateDraftNudgePlan({
    hasUnknownDrafts: true,
    permission: allowed,
    scheduled: [wrongTime, wrongCopy],
  })).toEqual({
    action: 'cancel-and-schedule',
    cancel: [wrongCopy, wrongTime],
    schedule: DRAFT_NUDGE_SCHEDULE,
    cleanupDelivered: false,
  });
});

test('recognizes only the exact feature marker as an owned duplicate', () => {
  expect(isOwnedDraftNudgeData('other-id', DRAFT_NUDGE_PAYLOAD)).toBe(true);
  expect(isOwnedDraftNudgeData('other-id', {
    kind: DRAFT_NUDGE_PAYLOAD.kind,
    version: 2,
    route: DRAFT_NUDGE_PAYLOAD.route,
  })).toBe(false);
  expect(isOwnedDraftNudgeData(DRAFT_NUDGE_IDENTIFIER, { kind: 'unrelated' })).toBe(true);
});

test('requires silent content and the repeating 20:00 trigger for a canonical match', () => {
  expect(isMatchingDraftNudgeRequest(request(DRAFT_NUDGE_IDENTIFIER, {
    content: {
      title: DRAFT_NUDGE_TITLE,
      body: DRAFT_NUDGE_BODY,
      data: DRAFT_NUDGE_PAYLOAD,
      sound: 'default',
      badge: null,
    },
  }))).toBe(false);
  expect(isMatchingDraftNudgeRequest(request(DRAFT_NUDGE_IDENTIFIER, {
    trigger: { kind: 'daily', repeats: false, hour: 20, minute: 0 },
  }))).toBe(false);
});
