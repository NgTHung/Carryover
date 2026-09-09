import { Text, View } from 'react-native';

import { HomeRouteLink } from '../HomeRouteLink';

export type TransactionRouteState =
  | { status: 'loading' }
  | { status: 'invalid'; message: string }
  | { status: 'unavailable'; transactionId: string; message?: string }
  | { status: 'error'; message: string };

export function TransactionRouteView({ state }: { state: TransactionRouteState }) {
  if (state.status === 'loading') {
    return <Message title="Loading transaction" detail="Reading the ledger." />;
  }

  if (state.status === 'invalid') {
    return <Message title="Invalid transaction link" detail={state.message} />;
  }

  if (state.status === 'unavailable') {
    return (
      <Message
        title="Transaction unavailable"
        detail={state.message ?? `No active transaction was found for ${state.transactionId}.`}
      />
    );
  }

  if (state.status === 'error') {
    return <Message title="Transaction could not load" detail={state.message} />;
  }

  return null;
}

function Message({ title, detail }: { title: string; detail: string }) {
  return (
    <View className="flex-1 justify-center gap-2 bg-ground-light px-5 dark:bg-ground-dark">
      <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
      <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">{title}</Text>
      <Text className="text-body text-muted-light dark:text-muted-dark" selectable>
        {detail}
      </Text>
      <HomeRouteLink />
    </View>
  );
}
