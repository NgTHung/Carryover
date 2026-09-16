import { Text, View } from 'react-native';
import { Link, type Href } from 'expo-router';

import { Button } from '../Button';
import { HomeRouteLink } from '../HomeRouteLink';
import {
  TRANSACTION_RETURN_ROUTE,
  type TransactionReturnRoute,
} from './transaction-return-route';

export type TransactionRouteState =
  | { status: 'loading' }
  | { status: 'invalid'; message: string }
  | { status: 'unavailable'; transactionId: string; message?: string }
  | { status: 'error'; message: string };

export function TransactionRouteView({
  state,
  returnRoute = TRANSACTION_RETURN_ROUTE,
}: {
  state: TransactionRouteState;
  returnRoute?: TransactionReturnRoute;
}) {
  if (state.status === 'loading') {
    return <Message title="Loading transaction" detail="Reading the ledger." returnRoute={returnRoute} />;
  }

  if (state.status === 'invalid') {
    return <Message title="Invalid transaction link" detail={state.message} returnRoute={returnRoute} />;
  }

  if (state.status === 'unavailable') {
    return (
      <Message
        title="Transaction unavailable"
        detail={state.message ?? `No active transaction was found for ${state.transactionId}.`}
        returnRoute={returnRoute}
      />
    );
  }

  if (state.status === 'error') {
    return <Message title="Transaction could not load" detail={state.message} returnRoute={returnRoute} />;
  }

  return null;
}

function Message({
  title,
  detail,
  returnRoute,
}: {
  title: string;
  detail: string;
  returnRoute: TransactionReturnRoute;
}) {
  return (
    <View className="flex-1 justify-center gap-2 bg-ground-light px-5 dark:bg-ground-dark">
      <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
      <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">{title}</Text>
      <Text className="text-body text-muted-light dark:text-muted-dark" selectable>
        {detail}
      </Text>
      <Link href={returnRoute.destination as Href} replace asChild>
        <Button variant="secondary">{returnRoute.label}</Button>
      </Link>
      <HomeRouteLink />
    </View>
  );
}
