/** Native route controller for a read-only dedicated transfer detail. */
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getTransferDetailData,
  subscribeLedgerChanges,
} from '../../ui/ledger-access';
import { TransferDetail } from '../../ui/transfers/TransferDetail';
import type { TransferDetailData } from '../../ui/transfers/transfer-data-contract';
import {
  loadTransferRoute,
  parseTransferRoute,
  type LoadedTransferRoute,
} from '../../ui/transfers/transfer-route';
import {
  TransferRouteView,
  type TransferRouteState,
} from '../../ui/transfers/TransferRouteView';

type RouteState = TransferRouteState | {
  status: 'ready';
  transfer: Extract<LoadedTransferRoute, { status: 'ready' }>['transfer'];
};

function parameterKey(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join('\u0000') : value ?? '';
}

export default function TransferRouteScreen({
  data = getTransferDetailData(),
  subscribe = subscribeLedgerChanges,
}: {
  data?: TransferDetailData;
  subscribe?: typeof subscribeLedgerChanges;
}) {
  const { transferId } = useLocalSearchParams<{
    transferId?: string | string[];
  }>();
  const routeKey = parameterKey(transferId);
  const parsed = useMemo(() => parseTransferRoute(transferId), [routeKey]);
  const [state, setState] = useState<RouteState>(() =>
    parsed.status === 'invalid' ? parsed : { status: 'loading' }
  );
  const requestRef = useRef(0);
  const mountedRef = useRef(false);
  const focusedRef = useRef(false);

  const load = useCallback(
    async (showLoading: boolean): Promise<void> => {
      const request = requestRef.current + 1;
      requestRef.current = request;
      if (parsed.status === 'invalid') {
        setState(parsed);
        return;
      }
      if (showLoading) setState({ status: 'loading' });
      try {
        const result = await loadTransferRoute(parsed.transferId, data.readTransfer);
        if (!mountedRef.current || request !== requestRef.current) return;
        setState(result);
      } catch (error: unknown) {
        if (mountedRef.current && request === requestRef.current) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      }
    },
    [data, parsed]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    void load(true).catch(() => undefined);
  }, [load, routeKey]);

  useFocusEffect(
    useCallback(() => {
      if (focusedRef.current) void load(false).catch(() => undefined);
      focusedRef.current = true;
      return undefined;
    }, [load])
  );

  useEffect(
    () =>
      subscribe((change) => {
        if (change.table === 'accounts' || change.table === 'transfers') {
          void load(false).catch(() => undefined);
        }
      }),
    [load, subscribe]
  );

  const back = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/transactions' as Href);
    }
  }, []);

  if (state.status === 'ready') {
    return <TransferDetail transfer={state.transfer} onBack={back} />;
  }
  return (
    <TransferRouteView
      state={state}
      onRetry={() => void load(true).catch(() => undefined)}
      onBack={back}
    />
  );
}
