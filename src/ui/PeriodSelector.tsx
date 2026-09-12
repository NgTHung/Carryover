import { Text, View } from 'react-native';

import { formatPeriod, shiftPeriod, type Period } from '../data/period';
import { Button } from './Button';

export function PeriodSelector({
  period,
  onChange,
}: {
  period: Period;
  onChange: (period: Period) => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <Button
        size="compact"
        variant="secondary"
        accessibilityLabel="Previous period"
        onPress={() => onChange(shiftPeriod(period, -1))}
      >
        ‹
      </Button>
      <Text accessibilityRole="header" className="text-body font-semibold text-ink-light dark:text-ink-dark">
        {formatPeriod(period)}
      </Text>
      <Button
        size="compact"
        variant="secondary"
        accessibilityLabel="Next period"
        onPress={() => onChange(shiftPeriod(period, 1))}
      >
        ›
      </Button>
    </View>
  );
}
