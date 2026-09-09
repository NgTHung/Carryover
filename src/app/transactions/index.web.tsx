import { Text, View } from 'react-native';

export default function TransactionsWebScreen() {
  return (
    <View className="flex-1 gap-2 bg-ground-light px-5 py-16 dark:bg-ground-dark">
      <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
      <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">Transactions</Text>
      <Text className="text-body text-muted-light dark:text-muted-dark">
        Transaction history is available in the installed iPhone build. The browser preview does not open the ledger.
      </Text>
    </View>
  );
}
