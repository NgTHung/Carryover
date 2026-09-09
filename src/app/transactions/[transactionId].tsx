import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { getTransactionEditorData } from '../../ui/ledger-access';
import { loadTransactionRoute, parseTransactionRoute } from '../../ui/transactions/load-transaction-route';
import { TransactionEditor } from '../../ui/transactions/TransactionEditor';
import {
  TransactionRouteView,
  type TransactionRouteState,
} from '../../ui/transactions/TransactionRouteView';
import type { TransactionEditorData } from '../../ui/transactions/transaction-editor-contract';

type RouteState = TransactionRouteState | {
  status: 'ready';
  transaction: Awaited<ReturnType<TransactionEditorData['readTransaction']>> & {};
  groups: Awaited<ReturnType<TransactionEditorData['listActiveCategoryGroups']>>;
  accounts: Awaited<ReturnType<TransactionEditorData['readAccountBalances']>>;
};

export default function TransactionRouteScreen({ data = getTransactionEditorData() }: { data?: TransactionEditorData }) {
  const { transactionId } = useLocalSearchParams<{
    transactionId?: string | string[];
  }>();
  const [state, setState] = useState<RouteState>(() => {
    const parsed = parseTransactionRoute(transactionId);
    return parsed.status === 'invalid' ? parsed : { status: 'loading' };
  });

  useEffect(() => {
    const parsed = parseTransactionRoute(transactionId);
    if (parsed.status === 'invalid') {
      setState(parsed);
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    void loadTransactionRoute(parsed.transactionId, data.readTransaction)
      .then(async (result) => {
        if (cancelled) return;
        if (result.status === 'invalid') {
          setState(result);
        } else if (result.status === 'unavailable') {
          setState(result);
        } else {
          const [groups, accounts] = await Promise.all([
            data.listActiveCategoryGroups(),
            data.readAccountBalances(),
          ]);
          if (cancelled) return;
          setState({
            status: 'ready',
            transaction: result.transaction,
            groups,
            accounts,
          });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [data, transactionId]);

  if (state.status === 'ready') {
    return (
      <TransactionEditor
        transaction={state.transaction}
        groups={state.groups}
        accounts={state.accounts}
        data={data}
        onDone={() => router.replace('/transactions' as Href)}
      />
    );
  }
  return <TransactionRouteView state={state} />;
}
