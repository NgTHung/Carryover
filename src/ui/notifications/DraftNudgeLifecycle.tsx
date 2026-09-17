/**
 * Keeps the native reminder service alive below the migration gate and routes
 * owned notification taps after Expo Router is ready.
 *
 * Responses can arrive before migrations or navigation finish. The validated
 * intent stays in memory until the fixed Drafts destination is confirmed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, usePathname, useRootNavigationState, type Href } from 'expo-router';

import { getDraftNudgeService, startDraftNudgeService } from '../../notifications/draft-nudge-access';
import {
  createDraftNudgeResponseDeduper,
  parseDraftNudgeResponse,
  type DraftNudgeNavigationIntent,
} from '../../notifications/draft-nudge-response';
import type { DraftNudgeResponse } from '../../notifications/draft-nudge-contract';
import type { DraftNudgeService } from '../../notifications/draft-nudge-service';

const processResponseDeduper = createDraftNudgeResponseDeduper();

export function DraftNudgeLifecycle({
  service = getDraftNudgeService(),
  navigationReady,
  pathname,
}: {
  service?: DraftNudgeService;
  navigationReady?: boolean;
  pathname?: string;
}) {
  const rootNavigationState = useRootNavigationState();
  const currentPathname = usePathname();
  const ready = navigationReady ?? rootNavigationState?.key !== undefined;
  const path = pathname ?? currentPathname;
  const [intent, setIntent] = useState<DraftNudgeNavigationIntent>();
  const [recoveryRevision, setRecoveryRevision] = useState(0);
  const pendingIntentRef = useRef<DraftNudgeNavigationIntent | undefined>(undefined);
  const navigationAttemptRef = useRef<string | undefined>(undefined);

  useEffect(() => startDraftNudgeService(), []);

  const receive = useCallback((response: DraftNudgeResponse | null): void => {
    const next = parseDraftNudgeResponse(response);
    if (
      next === undefined ||
      processResponseDeduper.hasHandled(next) ||
      pendingIntentRef.current?.deliveryId === next.deliveryId
    ) return;
    pendingIntentRef.current = next;
    setIntent(next);
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      // Register before reading the retained response so a live launch event
      // cannot arrive between those two operations.
      unsubscribe = service.subscribeToResponses(receive);
      receive(service.readLastResponse());
    } catch (error: unknown) {
      console.error('Could not register the daily reminder response handler', error);
    }
    return () => unsubscribe?.();
  }, [receive, service]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      navigationAttemptRef.current = undefined;
      setRecoveryRevision((current) => current + 1);
    });
    return () => subscription.remove();
  }, []);

  const confirmNavigation = useCallback((next: DraftNudgeNavigationIntent): void => {
    // A tap stays retryable across root remounts until Drafts is visible.
    processResponseDeduper.markHandled(next);
    try {
      const retained = parseDraftNudgeResponse(service.readLastResponse());
      if (retained?.deliveryId === next.deliveryId) {
        service.clearLastResponse();
      }
    } catch (error: unknown) {
      // The delivery is already deduplicated for this process. A later launch
      // can repair a retained response if native clearing failed.
      console.error('Could not clear the handled daily reminder response', error);
    }
    pendingIntentRef.current = undefined;
    navigationAttemptRef.current = undefined;
    setIntent(undefined);
  }, [service]);

  useEffect(() => {
    const pending = pendingIntentRef.current ?? intent;
    if (!ready || pending === undefined) return;
    if (path === '/drafts') {
      confirmNavigation(pending);
      return;
    }
    if (navigationAttemptRef.current === pending.deliveryId) return;
    try {
      navigationAttemptRef.current = pending.deliveryId;
      router.push('/drafts' as Href);
    } catch (error: unknown) {
      // Keep the intent. Navigation readiness and foreground recovery rerun
      // this effect without losing the validated tap.
      navigationAttemptRef.current = undefined;
      console.error('Could not open Drafts from the daily reminder', error);
    }
  }, [confirmNavigation, intent, path, ready, recoveryRevision]);

  return null;
}
