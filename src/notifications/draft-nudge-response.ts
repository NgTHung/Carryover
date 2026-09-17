/**
 * Validates and deduplicates taps on the owned daily reminder.
 *
 * The request identifier repeats across days, so a delivery date and action
 * identifier are part of the identity. Malformed or unrelated responses are
 * ignored without clearing the retained response for another feature.
 */
import type { DraftNudgeResponse } from './draft-nudge-contract';
import {
  DRAFT_NUDGE_DEFAULT_ACTION_IDENTIFIER,
  isValidDraftNudgePayload,
} from './draft-nudge-policy';

export type DraftNudgeNavigationIntent = {
  deliveryId: string;
  requestIdentifier: string;
  deliveredAt: number;
  route: '/drafts';
};

export function parseDraftNudgeResponse(
  response: DraftNudgeResponse | null | undefined
): DraftNudgeNavigationIntent | undefined {
  if (response === null || response === undefined) return undefined;
  if (
    response.actionIdentifier !== DRAFT_NUDGE_DEFAULT_ACTION_IDENTIFIER ||
    response.requestIdentifier.length === 0 ||
    !Number.isSafeInteger(response.deliveredAt) ||
    response.deliveredAt < 0 ||
    !isValidDraftNudgePayload(response.data)
  ) {
    return undefined;
  }

  return {
    deliveryId: [
      response.requestIdentifier,
      String(response.deliveredAt),
      response.actionIdentifier,
    ].join('\u0000'),
    requestIdentifier: response.requestIdentifier,
    deliveredAt: response.deliveredAt,
    route: '/drafts',
  };
}

export type DraftNudgeResponseDeduper = {
  hasHandled: (intent: DraftNudgeNavigationIntent) => boolean;
  markHandled: (intent: DraftNudgeNavigationIntent) => void;
};

export function createDraftNudgeResponseDeduper(): DraftNudgeResponseDeduper {
  const handled = new Set<string>();
  return {
    hasHandled: (intent) => handled.has(intent.deliveryId),
    markHandled(intent) {
      handled.add(intent.deliveryId);
    },
  };
}
