/** Read-only presentation for one dedicated transfer and its two accounts. */
import { Text, View } from 'react-native';

import { formatVnd } from '../../money/currency';
import { Button } from '../Button';
import type { TransferRead } from '../../data/transfer-reads';

function dateLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function accountKindLabel(kind: 'bank' | 'cash'): string {
  return kind === 'bank' ? 'Bank account' : 'Cash account';
}

export function TransferDetail({
  transfer,
  onBack,
}: {
  transfer: TransferRead;
  onBack: () => void;
}) {
  return (
    <View className="flex-1 gap-5 bg-ground-light px-5 pb-16 pt-16 dark:bg-ground-dark">
      <View className="gap-1">
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">Transfer</Text>
        <Text className="text-body text-muted-light dark:text-muted-dark">
          {dateLabel(transfer.transfer.occurredAt)}
        </Text>
      </View>

      <Text accessibilityLabel="Transfer amount" className="text-display font-bold tabular-nums text-ink-light dark:text-ink-dark">
        {formatVnd(transfer.transfer.amount)}
      </Text>

      <View className="gap-3 rounded-surface border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark">
        <View className="gap-1">
          <Text className="text-detail font-semibold uppercase text-muted-light dark:text-muted-dark">From</Text>
          <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">{transfer.fromAccount.name}</Text>
          <Text className="text-detail text-muted-light dark:text-muted-dark">{accountKindLabel(transfer.fromAccount.kind)}</Text>
        </View>
        <View className="gap-1">
          <Text className="text-detail font-semibold uppercase text-muted-light dark:text-muted-dark">To</Text>
          <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">{transfer.toAccount.name}</Text>
          <Text className="text-detail text-muted-light dark:text-muted-dark">{accountKindLabel(transfer.toAccount.kind)}</Text>
        </View>
      </View>

      <Text className="text-body text-muted-light dark:text-muted-dark">
        Moving money between your accounts does not count as spending or income.
      </Text>
      <Button variant="secondary" fullWidth onPress={onBack}>Back to transactions</Button>
    </View>
  );
}
