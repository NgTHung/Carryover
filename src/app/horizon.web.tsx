/** Browser preview route for the horizon editor with an explicit in-memory fixture. */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { FIXTURE_SNAPSHOT } from '../budget/snapshot';
import type { MonthConfig } from '../data/month-config-validation';
import { updateHorizonInputSchema } from '../data/month-config-validation';
import { periodEndDate, periodSchema, type Period } from '../data/period';
import { Button } from '../ui/Button';
import { HorizonForm } from '../ui/horizon/HorizonForm';
import type { HorizonEditorData } from '../ui/horizon/horizon-editor-contract';
import {
  parseHorizonRoute,
  type ParsedHorizonRoute,
} from '../ui/horizon/load-horizon-route';

const PREVIEW_PERIOD = '2026-09' as Period;

function previewConfig(period: Period): MonthConfig {
  return {
    period,
    openingBalance: FIXTURE_SNAPSHOT.balanceTotal,
    incomeTotal: 0,
    reservedTotal: FIXTURE_SNAPSHOT.reservedUnpaid,
    horizonDate: period === PREVIEW_PERIOD
      ? FIXTURE_SNAPSHOT.horizonDate
      : periodEndDate(period),
  };
}

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

export default function HorizonWebRoute({
  now = () => new Date(),
}: {
  now?: () => Date;
} = {}) {
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
  const configsRef = useRef(new Map<Period, MonthConfig>());
  const data = useMemo<HorizonEditorData>(() => ({
    readMonthConfig: async (period: unknown) => {
      const parsedPeriod = periodSchema.parse(period);
      return configsRef.current.get(parsedPeriod) ?? previewConfig(parsedPeriod);
    },
    updateHorizon: async (input: unknown) => {
      const parsedInput = updateHorizonInputSchema.parse(input);
      const current = configsRef.current.get(parsedInput.period) ?? previewConfig(parsedInput.period);
      const updated = { ...current, horizonDate: parsedInput.horizonDate };
      configsRef.current.set(parsedInput.period, updated);
      return updated;
    },
  }), []);
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; config: MonthConfig }
    | { status: 'error'; message: string }
  >({ status: 'loading' });
  const [savedMessage, setSavedMessage] = useState<string>();
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (parsed.status === 'invalid') return;
    const request = requestRef.current + 1;
    requestRef.current = request;
    setState({ status: 'loading' });
    try {
      const config = await data.readMonthConfig(parsed.period);
      if (request !== requestRef.current || config === undefined) return;
      setState({ status: 'ready', config });
    } catch (error: unknown) {
      if (request === requestRef.current) {
        setState({ status: 'error', message: errorMessage(error) });
      }
    }
  }, [data, parsed]);

  useEffect(() => {
    if (parsed.status === 'invalid') {
      return;
    }
    void load();
  }, [load, parsed]);

  useEffect(() => {
    if (parsed.status !== 'valid' || !parsed.defaulted) return;
    router.replace(`/horizon?period=${parsed.period}` as Href);
  }, [parsed]);

  const goHome = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/' as Href);
    }
  }, []);

  if (parsed.status === 'invalid') {
    return <RouteMessage title="Invalid horizon link" detail={parsed.message} />;
  }
  if (state.status === 'loading') {
    return <RouteMessage title="Change horizon" detail="Loading the preview horizon…" />;
  }
  if (state.status === 'error') {
    return (
      <RouteMessage
        title="Horizon could not load"
        detail={state.message}
        action={<Button onPress={() => void load()}>Try again</Button>}
      />
    );
  }

  return (
    <View className="flex-1">
      {savedMessage ? (
        <Text accessibilityRole="alert" className="absolute left-5 right-5 top-4 z-10 rounded-surface border border-need-light bg-surface-light p-3 text-detail text-ink-light dark:border-need-dark dark:bg-surface-dark dark:text-ink-dark">
          {savedMessage}
        </Text>
      ) : null}
      <HorizonForm
        period={parsed.period}
        config={state.config}
        data={data}
        onCancel={goHome}
        onSaved={() => setSavedMessage('Horizon saved in this browser preview.')}
      />
    </View>
  );
}
