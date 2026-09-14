/** Native route controller for commitment management and period navigation. */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import type { Period } from '../../data/period';
import { Button } from '../../ui/Button';
import type { CommitmentManagerData } from '../../ui/commitments/commitment-manager-contract';
import {
  CommitmentManagerView,
  type CommitmentManagerLoadState,
} from '../../ui/commitments/CommitmentManagerView';
import { reserveLeafChoices } from '../../ui/commitments/commitment-form';
import { parseCommitmentRoute } from '../../ui/commitments/load-commitment-route';
import {
  getCommitmentManagerData,
  subscribeLedgerChanges,
} from '../../ui/ledger-access';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function CommitmentManagerRoute({
  data = getCommitmentManagerData(),
  subscribe = subscribeLedgerChanges,
  now = () => new Date(),
}: {
  data?: CommitmentManagerData;
  subscribe?: typeof subscribeLedgerChanges;
  now?: () => Date;
}) {
  const { period: periodParam } = useLocalSearchParams<{
    period?: string | string[];
  }>();
  const periodKey = Array.isArray(periodParam)
    ? periodParam.join('\u0000')
    : periodParam;
  const openedAtRef = useRef(now());
  const parsed = useMemo(
    () => parseCommitmentRoute(periodParam, openedAtRef.current),
    [periodKey]
  );
  const [state, setState] = useState<CommitmentManagerLoadState>({ status: 'loading' });
  const requestRef = useRef(0);
  const mountedRef = useRef(false);

  const load = useCallback(async (): Promise<void> => {
    if (parsed.status === 'invalid') {
      return;
    }
    const request = requestRef.current + 1;
    requestRef.current = request;
    setState({ status: 'loading' });
    try {
      const [overview, groups] = await Promise.all([
        data.readCommitmentOverview(parsed.period),
        data.listActiveCategoryGroups(),
      ]);
      if (mountedRef.current && request === requestRef.current) {
        setState({
          status: 'ready',
          overview,
          choices: reserveLeafChoices(groups),
        });
      }
    } catch (error: unknown) {
      if (mountedRef.current && request === requestRef.current) {
        setState({ status: 'error', message: errorMessage(error) });
      }
      throw error;
    }
  }, [data, parsed]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (parsed.status === 'valid' && parsed.defaulted) {
      router.replace(`/settings/commitments?period=${parsed.period}` as Href);
    }
    void load().catch(() => undefined);
  }, [load, parsed]);

  useEffect(
    () =>
      subscribe((change) => {
        if (
          change.table === 'commitments' ||
          change.table === 'transactions' ||
          change.table === 'categories'
        ) {
          void load().catch(() => undefined);
        }
      }),
    [load, subscribe]
  );

  if (parsed.status === 'invalid') {
    return (
      <View className="flex-1 gap-2 bg-ground-light px-5 py-16 dark:bg-ground-dark">
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          Invalid commitment link
        </Text>
        <Text className="text-body text-error-light dark:text-error-dark">{parsed.message}</Text>
      </View>
    );
  }

  const changePeriod = (period: Period) => {
    router.replace(`/settings/commitments?period=${period}` as Href);
  };
  return (
    <CommitmentManagerView
      state={state}
      data={data}
      onReload={load}
      onChangePeriod={changePeriod}
      onOpenCategories={() => router.push('/settings/categories' as Href)}
      onRecordPayment={(commitmentId, period) =>
        router.push(
          `/transactions/new?mode=reserve-payment&commitmentId=${commitmentId}&period=${period}` as Href
        )
      }
      now={now}
    />
  );
}
