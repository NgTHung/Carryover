import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Period } from '../../data/period';
import type { MonthSummaryWithHistory } from '../../reports/month-summary';
import { Button } from '../Button';
import { PeriodSelector } from '../PeriodSelector';
import { CumulativePaceChart } from './CumulativePaceChart';
import { GroupSpendChart } from './GroupSpendChart';
import { QualityBreakdown } from './QualityBreakdown';
import {
  formatRegrettedLine,
  formatUnknownDrafts,
} from './month-summary-presentation';

export type MonthSummaryLoadState =
  | { status: 'loading' }
  | { status: 'ready'; summary: MonthSummaryWithHistory }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function MonthSummaryView({
  state,
  period,
  onChangePeriod,
  onRetry,
  previewNotice,
}: {
  state: MonthSummaryLoadState;
  period: Period;
  onChangePeriod: (period: Period) => void;
  onRetry: () => void;
  previewNotice?: string;
}) {
  return (
    <SafeAreaView className="flex-1 bg-ground-light dark:bg-ground-dark" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerClassName="grow gap-6 px-5 pb-8 pt-4"
        alwaysBounceVertical={false}
      >
        <View className="gap-5">
          <View className="gap-1">
            <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">
              REPORT
            </Text>
            <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
              Month summary
            </Text>
          </View>

          <PeriodSelector period={period} onChange={onChangePeriod} />

          {previewNotice ? (
            <Text className="rounded-surface border border-faint-light bg-surface-light p-3 text-detail text-muted-light dark:border-faint-dark dark:bg-surface-dark dark:text-muted-dark">
              {previewNotice}
            </Text>
          ) : null}

          <MonthSummaryState state={state} onRetry={onRetry} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MonthSummaryState({
  state,
  onRetry,
}: {
  state: MonthSummaryLoadState;
  onRetry: () => void;
}) {
  if (state.status === 'loading') {
    return (
      <Text className="text-body text-muted-light dark:text-muted-dark">
        Loading month summary…
      </Text>
    );
  }

  if (state.status === 'error') {
    return (
      <View className="gap-3">
        <Text className="text-body text-error-light dark:text-error-dark" accessibilityRole="alert">
          {state.message}
        </Text>
        <Button onPress={onRetry}>Try again</Button>
      </View>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <View className="gap-2">
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          Summary unavailable
        </Text>
        <Text className="text-body text-muted-light dark:text-muted-dark">
          This period has no stored month config, so its history cannot be reconstructed.
        </Text>
      </View>
    );
  }

  return <ReadySummary summary={state.summary} />;
}

function ReadySummary({ summary }: { summary: MonthSummaryWithHistory }) {
  return (
    <View className="gap-8">
      <GroupSpendChart summary={summary} />
      <QualityBreakdown summary={summary} />

      <View className="gap-2 border-t border-faint-light pt-4 dark:border-faint-dark">
        <Text className="text-body font-semibold tabular-nums text-regret-light dark:text-regret-dark">
          {formatRegrettedLine(summary)}
        </Text>
        {summary.unknownDrafts > 0 ? (
          <Text className="text-detail text-muted-light dark:text-muted-dark">
            {formatUnknownDrafts(summary.unknownDrafts)}
          </Text>
        ) : null}
      </View>
      <CumulativePaceChart history={summary.history} />
    </View>
  );
}
