/** Native route controller for editing a stored period horizon. */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { currentPeriod, type Period } from '../data/period';
import { selectSnapshotState, useSnapshotStore } from '../budget/snapshot-store';
import type { MonthConfig } from '../data/month-config-validation';
import { Button } from '../ui/Button';
import { HorizonForm } from '../ui/horizon/HorizonForm';
import type { HorizonEditorData } from '../ui/horizon/horizon-editor-contract';
import {
  parseHorizonRoute,
  type ParsedHorizonRoute,
} from '../ui/horizon/load-horizon-route';
import {
  getHorizonEditorData,
  retryBudgetSnapshot,
} from '../ui/ledger-access';

type HorizonLoadState =
  | { status: 'loading' }
  | { status: 'ready'; config: MonthConfig }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string; retry: 'read' | 'preparation' };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function RouteMessage({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <View className="flex-1 gap-3 bg-ground-light px-5 py-16 dark:bg-ground-dark">
      <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">
        BUDGET
      </Text>
      <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
        {title}
      </Text>
      <Text className="text-body text-muted-light dark:text-muted-dark" selectable>
        {detail}
      </Text>
      {action}
    </View>
  );
}

export default function HorizonRoute({
  data = getHorizonEditorData(),
  retryPreparation = retryBudgetSnapshot,
  now = () => new Date(),
}: {
  data?: HorizonEditorData;
  retryPreparation?: () => Promise<void>;
  now?: () => Date;
}) {
  const { period: periodParam } = useLocalSearchParams<{
    period?: string | string[];
  }>();
  const periodKey = Array.isArray(periodParam)
    ? periodParam.join('\u0000')
    : periodParam;
  const [openedAt] = useState(() => now());
  const parsed = useMemo(
    () => parseHorizonRoute(periodParam, openedAt),
    [openedAt, periodKey]
  );
  const snapshotStatus = useSnapshotStore(selectSnapshotState).status;
  const snapshotStatusRef = useRef(snapshotStatus);
  snapshotStatusRef.current = snapshotStatus;
  const [state, setState] = useState<HorizonLoadState>({ status: 'loading' });
  const [waitingForPreparation, setWaitingForPreparation] = useState(false);
  const [navigationError, setNavigationError] = useState<string>();
  const requestRef = useRef(0);
  const mountedRef = useRef(false);
  const writePendingRef = useRef(false);
  const [writePending, setWritePending] = useState(false);

  const isCurrentPeriod =
    parsed.status === 'valid' && currentPeriod(openedAt) === parsed.period;

  const load = useCallback(async (): Promise<void> => {
    if (parsed.status === 'invalid') return;
    const request = requestRef.current + 1;
    requestRef.current = request;
    setWaitingForPreparation(false);
    setState({ status: 'loading' });

    try {
      const config = await data.readMonthConfig(parsed.period);
      if (!mountedRef.current || request !== requestRef.current) return;

      if (config === undefined) {
        if (isCurrentPeriod && snapshotStatusRef.current === 'loading') {
          setWaitingForPreparation(true);
          return;
        }
        if (isCurrentPeriod && snapshotStatusRef.current === 'error') {
          setState({
            status: 'error',
            message: 'The current period could not be prepared.',
            retry: 'preparation',
          });
          return;
        }
        setState({
          status: 'unavailable',
          message: `No stored month config exists for ${parsed.period}.`,
        });
        return;
      }

      setState({ status: 'ready', config });
    } catch (error: unknown) {
      if (!mountedRef.current || request !== requestRef.current) return;
      setState({ status: 'error', message: errorMessage(error), retry: 'read' });
    }
  }, [data, isCurrentPeriod, parsed]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (parsed.status === 'invalid') {
      setWaitingForPreparation(false);
      return;
    }
    void load();
  }, [load, parsed]);

  useEffect(() => {
    if (!waitingForPreparation) return;
    if (snapshotStatus === 'ready') {
      setWaitingForPreparation(false);
      void load();
    } else if (snapshotStatus === 'error') {
      setWaitingForPreparation(false);
      setState({
        status: 'error',
        message: 'The current period could not be prepared.',
        retry: 'preparation',
      });
    }
  }, [load, snapshotStatus, waitingForPreparation]);

  useEffect(() => {
    if (parsed.status !== 'valid' || !parsed.defaulted) return;
    router.replace(`/horizon?period=${parsed.period}` as Href);
  }, [parsed]);

  const updateWritePending = useCallback((pending: boolean) => {
    if (writePendingRef.current === pending) return;
    writePendingRef.current = pending;
    setWritePending(pending);
  }, []);

  const preventRemove = useCallback(() => {
    if (!writePendingRef.current) return;
  }, []);
  usePreventRemove(writePending, preventRemove);

  const cancel = useCallback(() => {
    if (writePendingRef.current) return;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/' as Href);
    }
  }, []);

  const retry = useCallback(() => {
    if (state.status !== 'error') return;
    if (state.retry === 'read') {
      void load();
      return;
    }

    setState({ status: 'loading' });
    setWaitingForPreparation(true);
    void retryPreparation()
      .then(() => {
        if (!mountedRef.current) return;
        setWaitingForPreparation(false);
        void load();
      })
      .catch((error: unknown) => {
        if (!mountedRef.current) return;
        setWaitingForPreparation(false);
        setState({
          status: 'error',
          message: errorMessage(error),
          retry: 'preparation',
        });
      });
  }, [load, retryPreparation, state]);

  const onSaved = useCallback(() => {
    try {
      router.replace('/' as Href);
    } catch (error: unknown) {
      setNavigationError(errorMessage(error));
    }
  }, []);

  if (parsed.status === 'invalid') {
    return <RouteMessage title="Invalid horizon link" detail={parsed.message} />;
  }
  if (state.status === 'loading') {
    return (
      <RouteMessage
        title="Change horizon"
        detail={`Loading the stored horizon for ${parsed.period}…`}
      />
    );
  }
  if (state.status === 'unavailable') {
    return (
      <RouteMessage
        title="Horizon unavailable"
        detail={state.message}
        action={<Button variant="secondary" onPress={cancel}>Cancel</Button>}
      />
    );
  }
  if (state.status === 'error') {
    return (
      <RouteMessage
        title="Horizon could not load"
        detail={state.message}
        action={<Button onPress={retry}>Try again</Button>}
      />
    );
  }

  return (
    <HorizonForm
      period={parsed.period}
      config={state.config}
      data={data}
      onCancel={cancel}
      onSaved={onSaved}
      onWritePending={updateWritePending}
      navigationError={navigationError}
    />
  );
}
