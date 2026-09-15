/**
 * Builds the user actions that can repeat or abandon a capture boundary.
 *
 * Keeping cleanup and retry actions outside the controller keeps the hook
 * small while preserving one route-local set of locks and attempt refs.
 */
import type { Dispatch, RefObject, SetStateAction } from 'react';

import type { CapturePermission, CapturePhotoAccess } from './capture-contract';
import {
  captureResultHasCleanupIssues,
  errorMessage,
  isCaptureReviewState,
  type CaptureAttempt,
  type CaptureFailure,
  type CaptureOperationState,
} from './capture-operation';

type CaptureStateSetter = Dispatch<SetStateAction<CaptureOperationState>>;
type StringStateSetter = Dispatch<SetStateAction<string | undefined>>;

export type CaptureActionContext = {
  state: CaptureOperationState;
  permission: CapturePermission;
  photos: CapturePhotoAccess;
  onCancel: () => void | Promise<void>;
  mountedRef: RefObject<boolean>;
  shutterLockedRef: RefObject<boolean>;
  submitLockedRef: RefObject<boolean>;
  cancellationLockedRef: RefObject<boolean>;
  permissionRequestedRef: RefObject<boolean>;
  navigationAttemptedRef: RefObject<boolean>;
  takingPromiseRef: RefObject<Promise<{ uri: string } | undefined> | undefined>;
  attemptRef: RefObject<CaptureAttempt | undefined>;
  savedTransactionRef: RefObject<Extract<CaptureOperationState, { status: 'saved' }>['transaction'] | undefined>;
  setState: CaptureStateSetter;
  setAmountError: StringStateSetter;
  setTerminalPending: (pending: boolean) => void;
  currentAttempt: () => CaptureAttempt | undefined;
  startPreparation: (sourceUri: string, occurredAt: Date) => void;
  persistAttempt: (attempt: CaptureAttempt) => void;
  setFailure: (failure: CaptureFailure, attempt?: CaptureAttempt) => void;
};

export type CaptureActions = {
  submit: (amount: number | null) => void;
  cleanupAttempt: (target: 'cancel' | 'retake') => Promise<void>;
  retryPermission: () => void;
  retryPhoto: () => void;
  retrySubmit: () => void;
  retryNavigation: () => void;
};

export function createCaptureActions(context: CaptureActionContext): CaptureActions {
  const {
    state,
    permission,
    photos,
    onCancel,
    mountedRef,
    shutterLockedRef,
    submitLockedRef,
    cancellationLockedRef,
    permissionRequestedRef,
    navigationAttemptedRef,
    takingPromiseRef,
    attemptRef,
    savedTransactionRef,
    setState,
    setAmountError,
    setTerminalPending,
    currentAttempt,
    startPreparation,
    persistAttempt,
    setFailure,
  } = context;

  function submit(amount: number | null): void {
    if (
      submitLockedRef.current ||
      cancellationLockedRef.current ||
      !isCaptureReviewState(state.status)
    ) {
      return;
    }
    const attempt = currentAttempt();
    if (attempt === undefined || attempt.retained !== undefined) return;
    setAmountError(undefined);
    attempt.amount = amount;
    submitLockedRef.current = true;
    setTerminalPending(true);
    persistAttempt(attempt);
  }

  async function cleanupAttempt(target: 'cancel' | 'retake'): Promise<void> {
    if (cancellationLockedRef.current || submitLockedRef.current) return;
    const attempt = currentAttempt();
    if (attempt === undefined) {
      if (state.status === 'taking') {
        cancellationLockedRef.current = true;
        setTerminalPending(true);
        try {
          await takingPromiseRef.current?.catch(() => undefined);
          if (!mountedRef.current) return;
          if (target === 'cancel') {
            setTerminalPending(false);
            await onCancel();
          } else {
            cancellationLockedRef.current = false;
            setTerminalPending(false);
            shutterLockedRef.current = false;
            setState({ status: 'live', cameraReady: false });
          }
        } catch (error: unknown) {
          cancellationLockedRef.current = false;
          setFailure({ kind: 'cancellation', message: errorMessage(error), retry: 'cancel' });
        }
        return;
      }
      if (target === 'cancel') await onCancel();
      else {
        shutterLockedRef.current = false;
        setState({ status: 'live', cameraReady: false });
      }
      return;
    }
    if (attempt.retained !== undefined) return;
    cancellationLockedRef.current = true;
    setTerminalPending(true);
    attempt.controller.abort();
    try {
      const preparation = await attempt.preparation;
      if (attemptRef.current !== attempt || !mountedRef.current) return;
      if (preparation.status === 'prepared') attempt.prepared = preparation.photo;
      if (captureResultHasCleanupIssues(preparation)) {
        throw new Error('Photo cleanup did not finish. Try again.');
      }
      if (attempt.prepared !== undefined) {
        const discarded = await photos.discardPreparedPhoto(attempt.prepared);
        if (discarded.status !== 'discarded') {
          throw new Error(discarded.status === 'failed'
            ? discarded.preparation.error.message
            : 'The photo was retained and cannot be cancelled.');
        }
      }
      attemptRef.current = undefined;
      if (target === 'cancel') {
        setTerminalPending(false);
        await onCancel();
      } else {
        cancellationLockedRef.current = false;
        setTerminalPending(false);
        shutterLockedRef.current = false;
        setState({ status: 'live', cameraReady: false });
      }
    } catch (error: unknown) {
      cancellationLockedRef.current = false;
      setFailure(
        { kind: 'cancellation', message: errorMessage(error), retry: 'cancel' },
        attempt
      );
    }
  }

  function retryPermission(): void {
    if (permission.status !== 'denied' && permission.status !== 'undetermined') return;
    permissionRequestedRef.current = true;
    void permission.request().catch((error: unknown) => {
      if (mountedRef.current) {
        setState({ status: 'failed', failure: { kind: 'permission', message: errorMessage(error) } });
      }
    });
  }

  function retryPhoto(): void {
    const attempt = currentAttempt();
    if (attempt === undefined) {
      if (state.status === 'failed' && state.failure.kind === 'camera') {
        shutterLockedRef.current = false;
        setState({ status: 'live', cameraReady: false });
      }
      return;
    }
    if (attempt.retained !== undefined) return;
    if (state.status !== 'failed' || state.failure.kind !== 'photo') return;
    startPreparation(attempt.sourceUri, attempt.occurredAt);
  }

  function retrySubmit(): void {
    const attempt = currentAttempt();
    if (attempt === undefined || state.status !== 'failed') return;
    if (state.failure.kind !== 'retention' && state.failure.kind !== 'database') return;
    if (submitLockedRef.current || cancellationLockedRef.current) return;
    submitLockedRef.current = true;
    setTerminalPending(true);
    persistAttempt(attempt);
  }

  function retryNavigation(): void {
    const transaction = savedTransactionRef.current;
    if (transaction === undefined) return;
    navigationAttemptedRef.current = false;
    setState({ status: 'saved', transaction });
  }

  return { submit, cleanupAttempt, retryPermission, retryPhoto, retrySubmit, retryNavigation };
}
