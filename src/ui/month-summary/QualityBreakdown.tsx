import { Text, View } from 'react-native';

import type { MonthSummary, MonthSummaryQuality } from '../../reports/month-summary';
import {
  formatQualityAmount,
  QUALITY_LABELS,
  qualitySegmentClass,
  qualityTextClass,
} from './month-summary-presentation';

function qualityAccessibilityLabel(item: MonthSummaryQuality): string {
  return `${QUALITY_LABELS[item.quality]}, ${formatQualityAmount(item.amount)}`;
}

export function QualityBreakdown({ summary }: { summary: MonthSummary }) {
  return (
    <View className="gap-3" testID="summary-quality">
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          Quality
        </Text>
        <Text className="text-detail text-muted-light dark:text-muted-dark">
          Your spending quality, including unrated amounts.
        </Text>
      </View>

      {summary.totalSpent === 0 ? (
        <View className="h-6 rounded-surface bg-faint-light dark:bg-faint-dark" accessible={false} />
      ) : (
        <View
          accessibilityLabel={summary.quality.map(qualityAccessibilityLabel).join('. ')}
          className="h-6 flex-row gap-segment overflow-hidden rounded-surface bg-ground-light dark:bg-ground-dark"
        >
          {summary.quality.map((item) => (
            <View
              key={item.quality}
              className={`min-w-0 items-center justify-center ${qualitySegmentClass(item.quality)}`}
              style={{ flexBasis: 0, flexGrow: item.amount }}
            >
              {item.showDirectLabel ? (
                <Text className="px-1 text-detail font-semibold text-ground-dark" numberOfLines={1}>
                  {formatQualityAmount(item.amount)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

      <View className="gap-2">
        {summary.quality.map((item) => (
          <View key={item.quality} className="flex-row items-baseline justify-between gap-3">
            <View className="flex-1 flex-row items-center gap-2">
              <View className={`h-3 w-3 rounded-chip ${qualitySegmentClass(item.quality)}`} />
              <Text className={`text-body ${qualityTextClass(item.quality)}`}>
                {QUALITY_LABELS[item.quality]}
              </Text>
            </View>
            <Text className="text-body tabular-nums text-ink-light dark:text-ink-dark">
              {formatQualityAmount(item.amount)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
