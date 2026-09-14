/** Selected-period reserve status using only totals computed by the data layer. */
import { Text, View } from 'react-native';

import type { CommitmentOverview } from '../../data/commitment-overview';
import type { Period } from '../../data/period';
import { formatVnd } from '../../money/currency';
import { Button } from '../Button';
import { PeriodSelector } from '../PeriodSelector';

export function UnpaidReserveList({
  overview,
  disabled,
  futurePeriod,
  onChangePeriod,
  onRecordPayment,
}: {
  overview: CommitmentOverview;
  disabled: boolean;
  futurePeriod: boolean;
  onChangePeriod: (period: Period) => void;
  onRecordPayment: (commitmentId: string) => void;
}) {
  return (
    <View className="gap-3">
      <PeriodSelector period={overview.period} onChange={onChangePeriod} />
      <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">
        Unpaid reserves
      </Text>
      {overview.unpaidTotal.status === 'available' ? (
        <Text className="text-title font-bold tabular-nums text-ink-light dark:text-ink-dark">
          {formatVnd(overview.unpaidTotal.amount)}
        </Text>
      ) : (
        <Text accessibilityRole="alert" className="text-body text-error-light dark:text-error-dark">
          The unpaid total exceeds the safe VND limit. Edit, deactivate, or delete a commitment to restore it.
        </Text>
      )}
      {futurePeriod ? (
        <Text className="text-detail text-muted-light dark:text-muted-dark">
          A due date does not record money movement. Future periods cannot record payments.
        </Text>
      ) : null}
      {overview.items.map((item) =>
        item.state.status === 'unpaid' && item.state.nextToAcceptPayment ? (
          <View key={item.commitment.id} className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className="text-body text-ink-light dark:text-ink-dark">
              {item.commitment.name}, due {item.dueDate}
            </Text>
            <Button
              size="compact"
              disabled={disabled || futurePeriod || !item.leaf.active}
              onPress={() => onRecordPayment(item.commitment.id)}
            >
              Record payment
            </Button>
          </View>
        ) : null
      )}
    </View>
  );
}
