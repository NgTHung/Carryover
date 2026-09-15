/**
 * Parses capture links and identifies whether a route may start a new photo.
 *
 * A route id is also the SQLite idempotency key. Existing rows are classified
 * before permission or camera work so a retry cannot overwrite another row.
 */
import { z } from 'zod';

import { isPhotoKey } from '../../photos/photo-contract';
import type {
  DraftTransaction,
  Transaction,
} from '../../data/transaction-validation';

const captureDraftIdSchema = z.string().uuid();

export type ParsedCaptureRoute =
  | { status: 'valid'; draftId: string }
  | { status: 'invalid'; message: string };

export type CaptureRouteResolution =
  | { status: 'new' }
  | { status: 'saved'; transaction: DraftTransaction }
  | { status: 'collision'; message: string };

export function parseCaptureRoute(value: unknown): ParsedCaptureRoute {
  const parsed = captureDraftIdSchema.safeParse(value);
  return parsed.success
    ? { status: 'valid', draftId: parsed.data }
    : { status: 'invalid', message: 'This capture link is invalid.' };
}

function isSavedCapture(transaction: Transaction): transaction is DraftTransaction {
  return (
    transaction.deletedAt === null &&
    transaction.status === 'draft' &&
    transaction.direction === 'expense' &&
    transaction.adjustmentEffect === null &&
    transaction.categoryId === null &&
    transaction.quality === null &&
    transaction.payer.kind === 'you' &&
    transaction.photoKey !== null &&
    isPhotoKey(transaction.photoKey) &&
    transaction.note === null &&
    transaction.sourceLabel === null
  );
}

export function resolveCaptureRoute(
  transaction: Transaction | undefined
): CaptureRouteResolution {
  if (transaction === undefined) {
    return { status: 'new' };
  }
  if (isSavedCapture(transaction)) {
    return { status: 'saved', transaction };
  }
  return {
    status: 'collision',
    message: 'This capture link is already used by another transaction.',
  };
}
