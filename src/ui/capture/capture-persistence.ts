/**
 * Runs the retained-photo to SQLite boundary for one capture attempt.
 *
 * Retention and the draft write are deliberately separate. A failed database
 * call keeps the retained key so retrying cannot create another file.
 */
import type { Dispatch, SetStateAction } from 'react';

import type { CapturedDraftWriteResult } from '../../data/captured-drafts';
import type { DraftTransaction, Transaction } from '../../data/transaction-validation';
import type {
  PreparedPhoto,
  RetainedPhoto,
} from '../../photos/photo-contract';
import {
  capturePreparationFailure,
  errorMessage,
  type CaptureAttempt,
  type CaptureFailure,
  type CaptureOperationState,
} from './capture-operation';
import type { CapturePhotoAccess, CaptureScreenProps } from './capture-contract';
import { resolveCaptureRoute } from './capture-route';

type CaptureStateSetter = Dispatch<SetStateAction<CaptureOperationState>>;

export type CapturePersistenceOptions = {
  draftId: string;
  photos: CapturePhotoAccess;
  createCapturedDraft: CaptureScreenProps['createCapturedDraft'];
  readTransaction?: (id: string) => Promise<Transaction | undefined>;
  attempt: CaptureAttempt;
  isCurrent: (attempt: CaptureAttempt) => boolean;
  setState: CaptureStateSetter;
  setFailure: (failure: CaptureFailure, attempt: CaptureAttempt) => void;
  finishSaved: (transaction: Extract<CaptureOperationState, { status: 'saved' }>['transaction']) => void;
};

function validateSavedResult(
  result: CapturedDraftWriteResult,
  attempt: CaptureAttempt,
  retained: RetainedPhoto,
  draftId: string
): boolean {
  return (
    result.transaction.id === draftId &&
    result.transaction.status === 'draft' &&
    result.transaction.deletedAt === null &&
    result.transaction.photoKey === retained.photoKey &&
    result.transaction.amount === attempt.amount &&
    result.transaction.occurredAt.getTime() === attempt.occurredAt.getTime()
  );
}

type ReconcileResult =
  | { status: 'saved'; transaction: DraftTransaction }
  | { status: 'retry' }
  | { status: 'collision' };

async function reconcileWrite(
  options: CapturePersistenceOptions,
  retained: RetainedPhoto
): Promise<ReconcileResult> {
  if (options.readTransaction === undefined) return { status: 'retry' };
  const existing = await options.readTransaction(options.draftId);
  if (existing === undefined) return { status: 'retry' };
  const resolution = resolveCaptureRoute(existing);
  if (resolution.status === 'collision') return { status: 'collision' };
  if (
    resolution.status === 'saved' &&
    resolution.transaction.photoKey === retained.photoKey &&
    resolution.transaction.amount === options.attempt.amount &&
    resolution.transaction.occurredAt.getTime() === options.attempt.occurredAt.getTime()
  ) {
    return { status: 'saved', transaction: resolution.transaction };
  }
  return { status: 'collision' };
}

export async function persistCaptureAttempt(
  options: CapturePersistenceOptions
): Promise<void> {
  const { attempt } = options;
  if (!options.isCurrent(attempt)) return;

  let prepared: PreparedPhoto | undefined = attempt.prepared;
  if (prepared === undefined) {
    options.setState({
      status: 'preparing',
      sourceUri: attempt.sourceUri,
      occurredAt: attempt.occurredAt,
    });
    const preparation = await attempt.preparation;
    if (!options.isCurrent(attempt)) {
      if (preparation.status === 'prepared') {
        await options.photos.discardPreparedPhoto(preparation.photo).catch(() => undefined);
      }
      return;
    }
    if (preparation.status !== 'prepared') {
      options.setFailure(
        { kind: 'photo', message: capturePreparationFailure(preparation), retry: 'photo' },
        attempt
      );
      return;
    }
    prepared = preparation.photo;
    attempt.prepared = prepared;
  }

  let retained = attempt.retained;
  if (retained === undefined) {
    options.setState({
      status: 'retaining',
      sourceUri: attempt.sourceUri,
      occurredAt: attempt.occurredAt,
      amount: attempt.amount,
    });
    const retainedResult = await options.photos.retainPhoto(prepared);
    if (!options.isCurrent(attempt)) return;
    if (retainedResult.status !== 'retained') {
      options.setFailure(
        {
          kind: 'retention',
          message: retainedResult.preparation.error.message,
          retry: 'retention',
        },
        attempt
      );
      return;
    }
    retained = retainedResult.photo;
    attempt.retained = retained;
  }

  options.setState({
    status: 'writing',
    sourceUri: attempt.sourceUri,
    occurredAt: attempt.occurredAt,
    amount: attempt.amount,
    photoKey: retained.photoKey,
  });
  try {
    const result = await options.createCapturedDraft({
      draftId: options.draftId,
      photoKey: retained.photoKey,
      amount: attempt.amount,
      occurredAt: attempt.occurredAt,
    });
    if (!options.isCurrent(attempt)) return;
    if (!validateSavedResult(result, attempt, retained, options.draftId)) {
      options.setFailure(
        {
          kind: 'database',
          message: 'The saved draft did not match this capture.',
          retry: 'database',
        },
        attempt
      );
      return;
    }
    options.finishSaved(result.transaction);
  } catch (error: unknown) {
    if (!options.isCurrent(attempt)) return;
    try {
      const reconciled = await reconcileWrite(options, retained);
      if (reconciled.status === 'saved') {
        options.finishSaved(reconciled.transaction);
        return;
      }
      if (reconciled.status === 'collision') {
        options.setFailure(
          {
            kind: 'database',
            message: 'This capture id conflicts with another transaction.',
            retry: 'database',
          },
          attempt
        );
        return;
      }
    } catch (reconcileError: unknown) {
      error = reconcileError;
    }
    options.setFailure(
      { kind: 'database', message: errorMessage(error), retry: 'database' },
      attempt
    );
  }
}
