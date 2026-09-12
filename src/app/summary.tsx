import { useCallback, useEffect, useRef, useState } from 'react';

import type { MonthSummaryData } from '../data/month-summary';
import { getMonthSummaryData, subscribeLedgerChanges } from '../ui/ledger-access';
import {
  errorMessage,
  MonthSummaryView,
  type MonthSummaryLoadState,
} from '../ui/month-summary/MonthSummaryView';
import { useTransactionFilters } from '../ui/transactions/transaction-filters';

export default function MonthSummaryScreen({
  data = getMonthSummaryData(),
  subscribe = subscribeLedgerChanges,
}: {
  data?: MonthSummaryData<'async'>;
  subscribe?: typeof subscribeLedgerChanges;
}) {
  const period = useTransactionFilters((state) => state.selectedPeriod);
  const setSelectedPeriod = useTransactionFilters((state) => state.setSelectedPeriod);
  const [state, setState] = useState<MonthSummaryLoadState>({ status: 'loading' });
  const requestRef = useRef(0);
  const mountedRef = useRef(false);

  const load = useCallback(async () => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    setState({ status: 'loading' });
    try {
      const summary = await data.readMonthSummary(period);
      if (mountedRef.current && request === requestRef.current) {
        setState(summary === undefined ? { status: 'unavailable' } : { status: 'ready', summary });
      }
    } catch (error: unknown) {
      if (mountedRef.current && request === requestRef.current) {
        setState({ status: 'error', message: errorMessage(error) });
      }
    }
  }, [data, period]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () =>
      subscribe((change) => {
        if (
          change.table === 'transactions' ||
          change.table === 'categories' ||
          change.table === 'splits' ||
          change.table === 'month_config' ||
          change.table === 'transfers'
        ) {
          void load();
        }
      }),
    [load, subscribe]
  );

  return (
    <MonthSummaryView
      state={state}
      period={period}
      onChangePeriod={setSelectedPeriod}
      onRetry={() => void load()}
    />
  );
}
