import { StyleSheet, Text, View } from 'react-native';

import { HomeRouteLink } from '../navigation/HomeRouteLink';

export type TransactionRouteState =
  | { status: 'loading' }
  | { status: 'invalid'; message: string }
  | { status: 'unavailable'; transactionId: string; message?: string }
  | { status: 'ready'; transactionId: string; transactionStatus: string }
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

  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>CARRYOVER · TRANSACTION</Text>
      <Text style={styles.title}>Transaction loaded</Text>
      <Text style={styles.detail} selectable>
        {state.transactionId}
      </Text>
      <Text style={styles.detail}>Status: {state.transactionStatus}</Text>
      <HomeRouteLink />
    </View>
  );
}

function Message({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>CARRYOVER · TRANSACTION</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail} selectable>
        {detail}
      </Text>
      <HomeRouteLink />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#0D1614',
    padding: 20,
    gap: 8,
  },
  eyebrow: { color: '#46C4A4', fontSize: 11, letterSpacing: 1.6, fontWeight: '600' },
  title: { color: '#E4EAE7', fontSize: 28, fontWeight: '700' },
  detail: { color: '#97AAA5', fontSize: 13, lineHeight: 19 },
});
