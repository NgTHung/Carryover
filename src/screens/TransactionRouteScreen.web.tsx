import { useLocalSearchParams } from 'expo-router';

import { parseTransactionRoute } from '../navigation/load-transaction-route';
import {
  TransactionRouteView,
  type TransactionRouteState,
} from './TransactionRouteView';

export default function TransactionRouteScreen() {
  const { transactionId } = useLocalSearchParams<{
    transactionId?: string | string[];
  }>();
  const parsed = parseTransactionRoute(transactionId);
  const state: TransactionRouteState =
    parsed.status === 'invalid'
      ? parsed
      : {
          status: 'unavailable',
          transactionId: parsed.transactionId,
          message: 'The browser preview does not open the ledger.',
        };

  return <TransactionRouteView state={state} />;
}
