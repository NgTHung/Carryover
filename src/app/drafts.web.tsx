/** Browser fallback for the native-only draft inbox. */
import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../ui/Button';

export default function DraftsWebRoute() {
  return (
    <SafeAreaView className="flex-1 bg-ground-light dark:bg-ground-dark" edges={['top', 'bottom']}>
      <View className="flex-1 gap-4 px-5 py-8">
        <View className="gap-1">
          <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">CAPTURE</Text>
          <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">Drafts</Text>
        </View>
        <Text className="text-body text-muted-light dark:text-muted-dark">
          Drafts are available in the installed iPhone build. The browser preview does not open the ledger or photo storage.
        </Text>
        <View className="flex-row gap-2">
          <Link href="/" asChild>
            <Button variant="secondary" fullWidth className="flex-1">Home</Button>
          </Link>
          <Link href="/transactions" asChild>
            <Button variant="secondary" fullWidth className="flex-1">Transactions</Button>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
