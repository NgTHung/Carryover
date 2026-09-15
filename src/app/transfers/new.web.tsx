/** Browser fallback for the native transfer creation route. */
import { Text, View } from 'react-native';

export default function NewTransferWebRoute() {
  return (
    <View className="flex-1 gap-2 bg-ground-light px-5 py-16 dark:bg-ground-dark">
      <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
      <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">Record transfer</Text>
      <Text className="text-body text-muted-light dark:text-muted-dark">
        Transfers are available in the installed iPhone build. The browser preview does not open the ledger.
      </Text>
    </View>
  );
}
