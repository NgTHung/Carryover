import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import {
  getTransactionEditorData,
  subscribeLedgerChanges,
} from '../../ui/ledger-access';
import { loadTransactionRoute, parseTransactionRoute } from '../../ui/transactions/load-transaction-route';
import { TransactionEditor } from '../../ui/transactions/TransactionEditor';
import { TransactionAdjustmentDetail } from '../../ui/transactions/TransactionAdjustmentDetail';
import {
  TransactionRouteView,
  type TransactionRouteState,
} from '../../ui/transactions/TransactionRouteView';
import type { TransactionEditorData } from '../../ui/transactions/transaction-editor-contract';

type RouteState = TransactionRouteState | {
  status: 'ready';
  transaction: Awaited<ReturnType<TransactionEditorData['readTransaction']>> & {};
  groups: Awaited<ReturnType<TransactionEditorData['listActiveCategoryGroups']>>;
  accounts: Awaited<ReturnType<TransactionEditorData['listActiveAccounts']>>;
};

export default function TransactionRouteScreen({
  data = getTransactionEditorData(),
  subscribe = subscribeLedgerChanges,
}: {
  data?: TransactionEditorData;
  subscribe?: typeof subscribeLedgerChanges;
}) {
  const { transactionId } = useLocalSearchParams<{
    transactionId?: string | string[];
  }>();
  const [state, setState] = useState<RouteState>(() => {
    const parsed = parseTransactionRoute(transactionId);
    return parsed.status === 'invalid' ? parsed : { status: 'loading' };
  });
  const accountRefreshRequestRef = useRef(0);

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
            data.listActiveAccounts(),
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

  useEffect(
    () => {
      let active = true;
      return subscribe((change) => {
        if (change.table !== 'accounts') return;
        const request = accountRefreshRequestRef.current + 1;
        accountRefreshRequestRef.current = request;
        void data.listActiveAccounts()
          .then((accounts) => {
            if (!active || request !== accountRefreshRequestRef.current) return;
            setState((current) =>
              current.status === 'ready' ? { ...current, accounts } : current
            );
          })
          .catch(() => undefined);
      });
    },
    [data, subscribe]
  );

  if (state.status === 'ready') {
    if (state.transaction.direction === 'adjustment') {
      const account = state.accounts.find((candidate) => candidate.accountId === state.transaction.accountId);
      return (
        <TransactionAdjustmentDetail
          transaction={state.transaction}
          account={account}
          onDone={() => router.replace('/transactions' as Href)}
        />
      );
    }
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
