/**
 * Explains why capture is unavailable in the browser preview.
 *
 * Keeping this view free of camera and ledger imports lets Expo web route
 * discovery load the fallback without pulling native capture dependencies in.
 */
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeRouteLink } from '../HomeRouteLink';

export function CaptureUnavailableView() {
  return (
    <SafeAreaView className="flex-1 bg-ground-light px-5 py-6 dark:bg-ground-dark">
      <View className="gap-3">
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">
          CARRYOVER · CAPTURE
        </Text>
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          Capture is available on your iPhone
        </Text>
        <Text className="text-body text-muted-light dark:text-muted-dark">
          The browser preview cannot open the camera or save a photo draft.
        </Text>
        <HomeRouteLink />
      </View>
    </SafeAreaView>
  );
}
