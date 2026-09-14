import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { parseCommitmentRoute } from '../../ui/commitments/load-commitment-route';

export default function CommitmentManagerWebRoute() {
  const { period } = useLocalSearchParams<{ period?: string | string[] }>();
  const parsed = parseCommitmentRoute(period);
  return (
    <View className="flex-1 gap-2 bg-ground-light px-5 py-16 dark:bg-ground-dark">
      <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">SETTINGS</Text>
      <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
        {parsed.status === 'valid' ? 'Commitments' : 'Invalid commitment link'}
      </Text>
      <Text className="text-body text-muted-light dark:text-muted-dark">
        {parsed.status === 'valid'
          ? `Commitment management for ${parsed.period} is available in the installed iPhone build. The browser preview does not open the ledger.`
          : parsed.message}
      </Text>
    </View>
  );
}
