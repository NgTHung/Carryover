/**
 * Keeps the draft inbox synchronized with committed SQLite changes and app
 * lifecycle events.
 *
 * Every read gets a generation. Only the latest generation on a mounted
 * consumer may update the inbox, while a successful read advances thumbnail
 * revision so unavailable files can be retried after foregrounding.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import type {
  LedgerChange,
  LedgerChangeListener,
} from '../../data/ledger-change-notifier';
import type { DraftInboxLoadState, DraftInboxReader } from './draft-inbox-contract';
import { draftInboxErrorMessage } from './draft-inbox-contract';

export type DraftInboxAppState = {
  currentState: string | null;
  addEventListener(
    event: 'change',
    listener: (state: string) => void
  ): { remove(): void };
};

export type DraftInboxSubscription = (
  listener: LedgerChangeListener
) => () => void;

export type DraftInboxController = {
  state: DraftInboxLoadState;
  photoRevision: number;
  retry: () => void;
};

export function useDraftInbox({
  data,
  subscribe,
  appState = AppState,
}: {
  data: DraftInboxReader;
  subscribe: DraftInboxSubscription;
  appState?: DraftInboxAppState;
}): DraftInboxController {
  const [state, setState] = useState<DraftInboxLoadState>({ status: 'loading' });
  const [photoRevision, setPhotoRevision] = useState(0);
  const requestRef = useRef(0);
  const mountedRef = useRef(false);
  const focusedRef = useRef(false);

  const load = useCallback(
    async (showLoading: boolean): Promise<void> => {
      const request = requestRef.current + 1;
      requestRef.current = request;
      if (showLoading) setState({ status: 'loading' });

      try {
        const drafts = await data.readActiveDrafts();
        if (!mountedRef.current || request !== requestRef.current) return;
        setState({ status: 'ready', drafts });
        setPhotoRevision((current) => current + 1);
      } catch (error: unknown) {
        if (!mountedRef.current || request !== requestRef.current) return;
        setState({ status: 'error', message: draftInboxErrorMessage(error) });
      }
    },
    [data]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);

  useEffect(
    () =>
      subscribe((change: LedgerChange) => {
        if (change.table === 'transactions') {
          void load(false);
        }
      }),
    [load, subscribe]
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (focusedRef.current) {
        void load(false);
      }
      focusedRef.current = true;
      return undefined;
    }, [load])
  );

  useEffect(() => {
    let previousState = appState.currentState;
    const subscription = appState.addEventListener('change', (nextState) => {
      const becameActive = nextState === 'active' && previousState !== 'active';
      previousState = nextState;
      if (becameActive) {
        void load(false);
      }
    });

    return () => subscription.remove();
  }, [appState, load]);

  return {
    state,
    photoRevision,
    retry: () => {
      void load(true);
    },
  };
}
