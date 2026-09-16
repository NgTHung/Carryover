/**
 * Shared capture operation states and amount validation.
 *
 * Camera, photo, and SQLite work are separate terminal boundaries, so the UI
 * keeps their retry material explicit instead of combining them into flags.
 */
import { draftVndInputSchema } from '../../data/money-validation';
import type { DraftTransaction } from '../../data/transaction-validation';
import type {
  PhotoKey,
  PreparedPhoto,
  PreparePhotoResult,
  RetainedPhoto,
} from '../../photos/photo-contract';
import type { CapturePermission } from './capture-contract';

export type CaptureOperationState =
  | { status: 'permission-loading' }
  | { status: 'permission-undetermined' }
  | { status: 'permission-denied'; canAskAgain: boolean }
  | { status: 'live'; cameraReady: boolean }
  | { status: 'taking' }
  | { status: 'preparing'; sourceUri: string; occurredAt: Date }
  | { status: 'reviewing'; sourceUri: string; occurredAt: Date }
  | {
      status: 'retaining';
      sourceUri: string;
      occurredAt: Date;
      amount: number | null;
    }
  | {
      status: 'writing';
      sourceUri: string;
      occurredAt: Date;
      amount: number | null;
      photoKey: PhotoKey;
    }
  | {
      status: 'failed';
      sourceUri?: string;
      occurredAt?: Date;
      failure: CaptureFailure;
    }
  | { status: 'saved'; transaction: DraftTransaction };

export type CaptureFailure =
  | { kind: 'permission'; message: string }
  | { kind: 'camera'; message: string }
  | { kind: 'photo'; message: string; retry: 'photo' | 'retake' }
  | { kind: 'retention'; message: string; retry: 'retention' | 'retake' }
  | { kind: 'database'; message: string; retry: 'database' }
  | { kind: 'cancellation'; message: string; retry: 'cancel' }
  | { kind: 'navigation'; message: string; retry: 'navigation' };

export type CaptureAttempt = {
  sourceUri: string;
  occurredAt: Date;
  controller: AbortController;
  preparation: Promise<PreparePhotoResult>;
  prepared?: PreparedPhoto;
  retained?: RetainedPhoto;
  amount: number | null;
  persistWhenPrepared: boolean;
};

export type CaptureAmountResult =
  | { status: 'valid'; amount: number }
  | { status: 'invalid'; message: string };

export function initialCaptureState(permission: CapturePermission): CaptureOperationState {
  if (permission.status === 'loading') return { status: 'permission-loading' };
  if (permission.status === 'undetermined') return { status: 'permission-undetermined' };
  if (permission.status === 'denied') {
    return { status: 'permission-denied', canAskAgain: permission.canAskAgain };
  }
  return { status: 'live', cameraReady: false };
}

export function capturePreparationFailure(result: PreparePhotoResult): string {
  if (result.status === 'prepared') return 'Photo preparation returned an invalid result.';
  return result.preparation.error.message;
}

export function captureResultHasCleanupIssues(result: PreparePhotoResult): boolean {
  return result.status === 'cancelled'
    ? result.cleanupIssues.length > 0
    : result.status === 'failed' && result.preparation.cleanupIssues.length > 0;
}

export function captureSourceFromState(state: CaptureOperationState): string | undefined {
  return 'sourceUri' in state ? state.sourceUri : undefined;
}

export function captureDateFromState(state: CaptureOperationState): Date | undefined {
  return 'occurredAt' in state ? state.occurredAt : undefined;
}

export function isCaptureReviewState(status: CaptureOperationState['status']): boolean {
  return (
    status === 'preparing' ||
    status === 'reviewing' ||
    status === 'retaining' ||
    status === 'writing' ||
    status === 'failed'
  );
}

export function parseCaptureAmount(value: string): CaptureAmountResult {
  const parsed = draftVndInputSchema.safeParse(value);
  if (!parsed.success || parsed.data === null) {
    return {
      status: 'invalid',
      message: 'Enter a positive whole-dong VND amount, or choose Skip amount.',
    };
  }
  return { status: 'valid', amount: parsed.data };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
