import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { MonthSummary, MonthSummaryGroup } from '../../reports/month-summary';
import {
  formatExactAmount,
  formatGroupAmount,
} from './month-summary-presentation';

function groupAccessibilityLabel(group: MonthSummaryGroup): string {
  const leaves = group.leaves.length === 0
    ? 'No leaves.'
    : `${group.leaves.length} ${group.leaves.length === 1 ? 'leaf' : 'leaves'}.`;
  return `${group.name}, ${formatExactAmount(group.amount)}. ${leaves}`;
}

export function GroupSpendChart({ summary }: { summary: MonthSummary }) {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  return (
    <View className="gap-3" testID="summary-groups">
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          Spend by group
        </Text>
        <Text className="text-detail text-muted-light dark:text-muted-dark">
          Tap a group to show its leaves.
        </Text>
      </View>

      {summary.groups.length === 0 ? (
        <Text className="text-body text-muted-light dark:text-muted-dark">
          No spending in this period.
        </Text>
      ) : (
        summary.groups.map((group) => {
          const expanded = expandedGroupId === group.id;
          return (
            <View key={group.id} className="gap-1">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={groupAccessibilityLabel(group)}
                accessibilityState={{ expanded }}
                className="min-h-touch gap-2 rounded-surface border border-faint-light bg-surface-light p-3 active:opacity-80 dark:border-faint-dark dark:bg-surface-dark"
                onPress={() => setExpandedGroupId(expanded ? null : group.id)}
              >
                <View className="flex-row items-baseline justify-between gap-3">
                  <Text className="flex-1 text-body font-semibold text-ink-light dark:text-ink-dark">
                    {group.name}
                  </Text>
                  <Text className="text-body font-semibold tabular-nums text-ink-light dark:text-ink-dark">
                    {formatGroupAmount(group.amount)}
                  </Text>
                </View>
                <View
                  accessible={false}
                  className="h-2 flex-row overflow-hidden rounded-chip bg-ground-light dark:bg-ground-dark"
                >
                  <View
                    className="rounded-chip bg-spend-4-light dark:bg-spend-4-dark"
                    style={{ flexBasis: 0, flexGrow: group.amount }}
                  />
                  <View
                    className="bg-transparent"
                    style={{ flexBasis: 0, flexGrow: group.barRemainder }}
                  />
                </View>
              </Pressable>

              {expanded && group.leaves.length > 0 ? (
                <View className="ml-4 gap-1 border-l-2 border-faint-light pl-3 dark:border-faint-dark">
                  {group.leaves.map((leaf) => (
                    <View
                      key={leaf.id}
                      accessible
                      accessibilityLabel={`${leaf.name}, ${formatExactAmount(leaf.amount)}`}
                      className="flex-row items-baseline justify-between gap-3"
                    >
                      <Text className="flex-1 text-detail text-muted-light dark:text-muted-dark">
                        {leaf.name}
                      </Text>
                      <Text className="text-detail tabular-nums text-muted-light dark:text-muted-dark">
                        {formatGroupAmount(leaf.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}
