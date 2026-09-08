import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { transactionData } from '../data/database';
import { loadTransactionRoute, parseTransactionRoute } from '../navigation/load-transaction-route';
import {
  TransactionRouteView,
  type TransactionRouteState,
} from './TransactionRouteView';

export default function TransactionRouteScreen() {
  const { transactionId } = useLocalSearchParams<{
    transactionId?: string | string[];
  }>();
  const [state, setState] = useState<TransactionRouteState>(() => {
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

    void loadTransactionRoute(parsed.transactionId, transactionData.readTransaction)
      .then((result) => {
        if (cancelled) return;
        if (result.status === 'invalid') {
          setState(result);
        } else if (result.status === 'unavailable') {
          setState(result);
        } else {
          setState({
            status: 'ready',
            transactionId: result.transaction.id,
            transactionStatus: result.transaction.status,
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
  }, [transactionId]);

  return <TransactionRouteView state={state} />;
}
