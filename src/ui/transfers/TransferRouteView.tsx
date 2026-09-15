/** Loading, invalid, unavailable, and retryable states for transfer routes. */
import { Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { Button } from '../Button';

export type TransferRouteState =
  | { status: 'loading' }
  | { status: 'invalid'; message: string }
  | { status: 'unavailable'; transferId: string; message?: string }
  | { status: 'error'; message: string };

export function TransferRouteView({
  state,
  onRetry,
  onBack,
}: {
  state: TransferRouteState;
  onRetry?: () => void;
  onBack: () => void;
}) {
  if (state.status === 'loading') {
    return <Message title="Loading transfer" detail="Reading the ledger." onBack={onBack} />;
  }
  if (state.status === 'invalid') {
    return <Message title="Invalid transfer link" detail={state.message} onBack={onBack} />;
  }
  if (state.status === 'unavailable') {
    return (
      <Message
        title="Transfer unavailable"
        detail={state.message ?? `No active transfer was found for ${state.transferId}.`}
        onBack={onBack}
      />
    );
  }
  return (
    <Message
      title="Transfer could not load"
      detail={state.message}
      action={onRetry ? <Button onPress={onRetry}>Try again</Button> : undefined}
      onBack={onBack}
    />
  );
}

function Message({
  title,
  detail,
  action,
  onBack,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
  onBack: () => void;
}) {
  return (
    <View className="flex-1 justify-center gap-3 bg-ground-light px-5 dark:bg-ground-dark">
      <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
      <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">{title}</Text>
      <Text className="text-body text-muted-light dark:text-muted-dark" selectable>{detail}</Text>
      {action}
      <Button variant="secondary" onPress={onBack}>Back to transactions</Button>
    </View>
  );
}
