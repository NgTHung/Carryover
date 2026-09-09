import { useCallback, useEffect, useRef, useState } from 'react';

import { getTransactionListData, subscribeLedgerChanges } from '../../ui/ledger-access';
import type { TransactionListData } from '../../data/transaction-list';
import { TransactionListView, type TransactionListLoadState, errorMessage } from '../../ui/transactions/TransactionListView';
import { useTransactionFilters } from '../../ui/transactions/transaction-filters';

export default function TransactionsScreen({
  data = getTransactionListData(),
  subscribe = subscribeLedgerChanges,
}: {
  data?: TransactionListData<'sync'>;
  subscribe?: (listener: Parameters<typeof subscribeLedgerChanges>[0]) => () => void;
}) {
  const selectedPeriod = useTransactionFilters((state) => state.selectedPeriod);
  const categoryId = useTransactionFilters((state) => state.categoryId);
  const accountId = useTransactionFilters((state) => state.accountId);
  const quality = useTransactionFilters((state) => state.quality);
  const reset = useTransactionFilters((state) => state.reset);
  const setSelectedPeriod = useTransactionFilters((state) => state.setSelectedPeriod);
  const setCategoryId = useTransactionFilters((state) => state.setCategoryId);
  const setAccountId = useTransactionFilters((state) => state.setAccountId);
  const setQuality = useTransactionFilters((state) => state.setQuality);
  const [state, setState] = useState<TransactionListLoadState>({ status: 'loading' });
  const [optionRows, setOptionRows] = useState<Awaited<ReturnType<TransactionListData<'sync'>['readTransactionList']>>>([]);
  const requestRef = useRef(0);
  const optionRequestRef = useRef(0);
  const mountedRef = useRef(false);

  const load = useCallback(async () => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    setState({ status: 'loading' });
    try {
      const rows = await data.readTransactionList({ period: selectedPeriod, categoryId, accountId, quality });
      if (mountedRef.current && request === requestRef.current) setState({ status: 'ready', rows });
    } catch (error: unknown) {
      if (mountedRef.current && request === requestRef.current) setState({ status: 'error', message: errorMessage(error) });
    }
  }, [accountId, categoryId, data, quality, selectedPeriod]);

  const loadOptions = useCallback(async () => {
    const request = optionRequestRef.current + 1;
    optionRequestRef.current = request;
    try {
      const rows = await data.readTransactionList({
        period: selectedPeriod,
        categoryId: null,
        accountId: null,
        quality: null,
      });
      if (mountedRef.current && request === optionRequestRef.current) setOptionRows(rows);
    } catch (error: unknown) {
      if (mountedRef.current && request === optionRequestRef.current) {
        setState({ status: 'error', message: errorMessage(error) });
      }
    }
  }, [data, selectedPeriod]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      optionRequestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => subscribe((change) => {
    if (change.table === 'transactions' || change.table === 'transfers' || change.table === 'categories' || change.table === 'accounts') {
      void load();
      void loadOptions();
    }
  }), [load, loadOptions, subscribe]);

  const filters = {
    selectedPeriod,
    categoryId,
    accountId,
    quality,
    setSelectedPeriod,
    setCategoryId,
    setAccountId,
    setQuality,
    reset,
  };

  return <TransactionListView state={state} optionRows={optionRows} filters={filters} onReset={reset} onRetry={() => void load()} />;
}
