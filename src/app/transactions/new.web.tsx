/**
 * Browser fallback for the manual creation route.
 *
 * Keeping this module free of the ledger facade prevents Expo web route
 * discovery from importing SQLite or requesting native migration state.
 */
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import {
  parseTransactionCreationRoute,
} from '../../ui/transactions/load-transaction-route';
import { TransactionRouteView } from '../../ui/transactions/TransactionRouteView';

export default function NewTransactionWebRoute() {
  const { direction } = useLocalSearchParams<{
    direction?: string | string[];
  }>();
  const parsed = parseTransactionCreationRoute(direction);
  if (parsed.status === 'invalid') {
    return <TransactionRouteView state={parsed} />;
  }

  return (
    <View className="flex-1 gap-2 bg-ground-light px-5 py-16 dark:bg-ground-dark">
      <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
      <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
        Add {parsed.direction}
      </Text>
      <Text className="text-body text-muted-light dark:text-muted-dark">
        Manual transactions are available in the installed iPhone build. The browser preview does not open the ledger.
      </Text>
    </View>
  );
}
