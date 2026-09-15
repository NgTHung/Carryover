/**
 * Owns the asynchronous boundaries for one route-local capture attempt.
 *
 * The view stays declarative while this hook keeps preparation, retention,
 * writing, cancellation, and navigation retries independent.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { type TextInput } from 'react-native';

import type { PreparePhotoResult } from '../../photos/photo-contract';
import type { CaptureScreenProps } from './capture-contract';
import { createCaptureActions } from './capture-actions';
import {
  capturePreparationFailure,
  captureResultHasCleanupIssues,
  captureSourceFromState,
  errorMessage,
  initialCaptureState,
  isCaptureReviewState,
  parseCaptureAmount,
  type CaptureAttempt,
  type CaptureFailure,
  type CaptureOperationState,
} from './capture-operation';
import { persistCaptureAttempt } from './capture-persistence';

type SavedTransaction = Extract<CaptureOperationState, { status: 'saved' }>['transaction'];

export type CaptureController = {
  state: CaptureOperationState;
  amountRef: RefObject<TextInput | null>;
  amountText: string;
  amountError?: string;
  terminalPending: boolean;
  cancelDisabled: boolean;
  sourceUri?: string;
  reviewVisible: boolean;
  onAmountChange: (value: string) => void;
  onCameraReady: () => void;
  onCameraError: (error: unknown) => void;
  onTakePhoto: () => void;
  onDone: () => void;
  onSkipAmount: () => void;
  onCancel: () => void;
  onRetryPermission: () => void;
  onRetryPhoto: () => void;
  onRetrySubmit: () => void;
  onRetryNavigation: () => void;
  onRetake: () => void;
};

export function useCaptureController({
  draftId,
  camera,
  permission,
  photos,
  createCapturedDraft,
  readTransaction,
  isFocused,
  isAppActive,
  onCancel,
  onNavigateHome,
  onTerminalPending,
  now = () => new Date(),
}: CaptureScreenProps): CaptureController {
  const [state, setState] = useState<CaptureOperationState>(() => initialCaptureState(permission));
  const [amountText, setAmountText] = useState('');
  const [amountError, setAmountError] = useState<string>();
  const amountRef = useRef<TextInput>(null);
  const mountedRef = useRef(false);
  const shutterLockedRef = useRef(false);
  const submitLockedRef = useRef(false);
  const cancellationLockedRef = useRef(false);
  const permissionRequestedRef = useRef(false);
  const navigationAttemptedRef = useRef(false);
  const takingPromiseRef = useRef<Promise<{ uri: string } | undefined> | undefined>(undefined);
  const attemptRef = useRef<CaptureAttempt | undefined>(undefined);
  const savedTransactionRef = useRef<SavedTransaction | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      attemptRef.current?.controller.abort();
      takingPromiseRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (permission.status === 'undetermined' && !permissionRequestedRef.current) {
      permissionRequestedRef.current = true;
      void permission.request().catch((error: unknown) => {
        if (!mountedRef.current) return;
        setState({
          status: 'failed',
          failure: { kind: 'permission', message: errorMessage(error) },
        });
      });
      return;
    }

    setState((previous) => {
      if (
        previous.status !== 'permission-loading' &&
        previous.status !== 'permission-undetermined' &&
        previous.status !== 'permission-denied'
      ) {
        return previous;
      }
      return initialCaptureState(permission);
    });
  }, [permission]);

  useEffect(() => {
    if (!isAppActive || permission.status !== 'denied' || permission.refresh === undefined) {
      return;
    }
    void permission.refresh().catch(() => undefined);
  }, [isAppActive, permission]);

  useEffect(() => {
    if (state.status === 'live' && state.cameraReady && isFocused && isAppActive) {
      amountRef.current?.focus();
    }
  }, [isAppActive, isFocused, state]);

  useEffect(() => {
    if (state.status !== 'saved' || !isFocused || !isAppActive) return;
    if (navigationAttemptedRef.current) return;
    navigationAttemptedRef.current = true;
    void Promise.resolve(onNavigateHome()).catch((error: unknown) => {
      if (!mountedRef.current) return;
      navigationAttemptedRef.current = false;
      setState({
        status: 'failed',
        failure: { kind: 'navigation', message: errorMessage(error), retry: 'navigation' },
      });
    });
  }, [isAppActive, isFocused, onNavigateHome, state]);

  function setTerminalPending(pending: boolean): void {
    onTerminalPending?.(pending);
  }

  function currentAttempt(): CaptureAttempt | undefined {
    return attemptRef.current;
  }

  function isCurrent(attempt: CaptureAttempt): boolean {
    return mountedRef.current && attemptRef.current === attempt;
  }

  function clearSubmitLock(): void {
    submitLockedRef.current = false;
    setTerminalPending(false);
  }

  function setFailure(
    failure: CaptureFailure,
    attempt: CaptureAttempt | undefined = currentAttempt()
  ): void {
    if (!mountedRef.current) return;
    clearSubmitLock();
    setState({
      status: 'failed',
      sourceUri: attempt?.sourceUri,
      occurredAt: attempt?.occurredAt,
      failure,
    });
  }

  async function handlePreparationResult(
    attempt: CaptureAttempt,
    result: PreparePhotoResult
  ): Promise<void> {
    if (!isCurrent(attempt)) {
      if (result.status === 'prepared') {
        await photos.discardPreparedPhoto(result.photo).catch(() => undefined);
      }
      return;
    }
    if (result.status === 'prepared') {
      attempt.prepared = result.photo;
      setState((previous) =>
        previous.status === 'preparing'
          ? {
              status: 'reviewing',
              sourceUri: attempt.sourceUri,
              occurredAt: attempt.occurredAt,
            }
          : previous
      );
      return;
    }
    if (cancellationLockedRef.current) return;
    setFailure(
      {
        kind: 'photo',
        message: captureResultHasCleanupIssues(result)
          ? `${capturePreparationFailure(result)} Photo cleanup needs another try.`
          : capturePreparationFailure(result),
        retry: 'photo',
      },
      attempt
    );
  }

  function startPreparation(
    sourceUri: string,
    occurredAt: Date,
    amount = attemptRef.current?.amount ?? null
  ): void {
    const controller = new AbortController();
    const preparation = photos.preparePhoto(sourceUri, { signal: controller.signal });
    const attempt: CaptureAttempt = {
      sourceUri,
      occurredAt,
      controller,
      preparation,
      amount,
    };
    attemptRef.current = attempt;
    setState({ status: 'preparing', sourceUri, occurredAt });
    void preparation
      .then((result) => handlePreparationResult(attempt, result))
      .catch((error: unknown) => {
        if (isCurrent(attempt) && !cancellationLockedRef.current) {
          setFailure({ kind: 'photo', message: errorMessage(error), retry: 'photo' }, attempt);
        }
      });
  }

  async function takePhoto(): Promise<void> {
    if (
      shutterLockedRef.current ||
      state.status !== 'live' ||
      !state.cameraReady ||
      !isFocused ||
      !isAppActive
    ) {
      return;
    }
    shutterLockedRef.current = true;
    setState({ status: 'taking' });
    try {
      const takingPromise = camera.takePicture();
      takingPromiseRef.current = takingPromise;
      const picture = await takingPromise;
      takingPromiseRef.current = undefined;
      if (!mountedRef.current) return;
      if (cancellationLockedRef.current) return;
      if (picture === undefined || picture.uri === '') {
        throw new Error('The camera did not return a photo.');
      }
      startPreparation(picture.uri, now());
    } catch (error: unknown) {
      takingPromiseRef.current = undefined;
      if (!mountedRef.current) return;
      if (cancellationLockedRef.current) return;
      shutterLockedRef.current = false;
      setState({
        status: 'failed',
        failure: { kind: 'camera', message: errorMessage(error) },
      });
    }
  }

  function onCameraReady(): void {
    setState((previous) =>
      previous.status === 'live'
        ? { status: 'live', cameraReady: true }
        : previous
    );
  }

  function onCameraError(error: unknown): void {
    if (state.status === 'live' || state.status === 'taking') {
      shutterLockedRef.current = false;
      setState({ status: 'failed', failure: { kind: 'camera', message: errorMessage(error) } });
    }
  }

  function amountForDone(): number | undefined {
    const result = parseCaptureAmount(amountText);
    if (result.status === 'invalid') {
      setAmountError(result.message);
      return undefined;
    }
    setAmountError(undefined);
    return result.amount;
  }

  function finishSaved(transaction: SavedTransaction): void {
    savedTransactionRef.current = transaction;
    clearSubmitLock();
    setState({ status: 'saved', transaction });
  }

  function persistAttempt(attempt: CaptureAttempt): void {
    void persistCaptureAttempt({
      draftId,
      photos,
      createCapturedDraft,
      readTransaction,
      attempt,
      isCurrent,
      setState,
      setFailure,
      finishSaved,
    });
  }

  const {
    submit,
    cleanupAttempt,
    retryPermission,
    retryPhoto,
    retrySubmit,
    retryNavigation,
  } = createCaptureActions({
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
  });

  const sourceUri = captureSourceFromState(state);
  const reviewVisible =
    permission.status === 'granted' &&
    (isCaptureReviewState(state.status) || state.status === 'saved');
  const terminalPending = submitLockedRef.current || cancellationLockedRef.current;
  const cancelDisabled = terminalPending || currentAttempt()?.retained !== undefined;

  return {
    state,
    amountRef,
    amountText,
    amountError,
    terminalPending,
    cancelDisabled,
    sourceUri,
    reviewVisible,
    onAmountChange: (value) => {
      setAmountText(value);
      setAmountError(undefined);
    },
    onCameraReady,
    onCameraError,
    onTakePhoto: () => void takePhoto(),
    onDone: () => {
      const amount = amountForDone();
      if (amount !== undefined) submit(amount);
    },
    onSkipAmount: () => submit(null),
    onCancel: () => void cleanupAttempt('cancel'),
    onRetryPermission: retryPermission,
    onRetryPhoto: retryPhoto,
    onRetrySubmit: retrySubmit,
    onRetryNavigation: retryNavigation,
    onRetake: () => void cleanupAttempt('retake'),
  };
}
