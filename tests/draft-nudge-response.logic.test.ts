import type { DraftNudgeResponse } from '../src/notifications/draft-nudge-contract';
import {
  DRAFT_NUDGE_DEFAULT_ACTION_IDENTIFIER,
  DRAFT_NUDGE_PAYLOAD,
} from '../src/notifications/draft-nudge-policy';
import {
  createDraftNudgeResponseDeduper,
  parseDraftNudgeResponse,
} from '../src/notifications/draft-nudge-response';

function response(overrides: Partial<DraftNudgeResponse> = {}): DraftNudgeResponse {
  return {
    requestIdentifier: 'carryover.unknown-drafts.daily.v1',
    deliveredAt: 1_757_000_000_000,
    actionIdentifier: DRAFT_NUDGE_DEFAULT_ACTION_IDENTIFIER,
    data: DRAFT_NUDGE_PAYLOAD,
    ...overrides,
  };
}

test('accepts the default action only when the feature payload is valid', () => {
  expect(parseDraftNudgeResponse(response())).toEqual({
    deliveryId: [
      'carryover.unknown-drafts.daily.v1',
      '1757000000000',
      DRAFT_NUDGE_DEFAULT_ACTION_IDENTIFIER,
    ].join('\u0000'),
    requestIdentifier: 'carryover.unknown-drafts.daily.v1',
    deliveredAt: 1_757_000_000_000,
    route: '/drafts',
  });
  expect(parseDraftNudgeResponse(response({ actionIdentifier: 'reply' }))).toBeUndefined();
  expect(parseDraftNudgeResponse(response({ data: { kind: 'other' } }))).toBeUndefined();
});

test('rejects empty identifiers and unsafe delivery dates', () => {
  expect(parseDraftNudgeResponse(response({ requestIdentifier: '' }))).toBeUndefined();
  expect(parseDraftNudgeResponse(response({ deliveredAt: -1 }))).toBeUndefined();
  expect(parseDraftNudgeResponse(response({ deliveredAt: Number.MAX_SAFE_INTEGER + 1 }))).toBeUndefined();
  expect(parseDraftNudgeResponse(null)).toBeUndefined();
  expect(parseDraftNudgeResponse(undefined)).toBeUndefined();
});

test('deduplicates retained and live deliveries but keeps later days distinct', () => {
  const deduper = createDraftNudgeResponseDeduper();
  const first = parseDraftNudgeResponse(response());
  const nextDay = parseDraftNudgeResponse(response({ deliveredAt: 1_757_086_400_000 }));
  if (first === undefined || nextDay === undefined) throw new Error('Expected valid intents');

  expect(deduper.hasHandled(first)).toBe(false);
  expect(deduper.hasHandled({ ...first })).toBe(false);
  deduper.markHandled(first);
  expect(deduper.hasHandled({ ...first })).toBe(true);
  expect(deduper.hasHandled(nextDay)).toBe(false);
});
