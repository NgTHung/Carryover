import { Text, View } from 'react-native';

import type { ActiveAccount } from '../../data/accounts';
import type { Transaction } from '../../data/transaction-validation';
import { formatVnd } from '../../money/currency';
import { Button } from '../Button';
import { HomeRouteLink } from '../HomeRouteLink';
import { adjustmentEffectLabel } from './adjustment';

function dateLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function TransactionAdjustmentDetail({
  transaction,
  account,
  onDone,
}: {
  transaction: Transaction;
  account: ActiveAccount | undefined;
  onDone: () => void;
}) {
  const effect = adjustmentEffectLabel(transaction) ?? 'Balance adjustment';
  return (
    <View className="flex-1 gap-5 bg-ground-light px-5 py-16 dark:bg-ground-dark">
      <View className="gap-1">
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">Adjustment</Text>
        <Text className="text-body text-muted-light dark:text-muted-dark">Read-only account maintenance</Text>
      </View>

      <View accessible accessibilityLabel={`${transaction.amount === null ? 'Unknown' : formatVnd(transaction.amount)}, ${effect}`} className="gap-3 rounded-surface border border-faint-light bg-surface-light p-4 opacity-75 dark:border-faint-dark dark:bg-surface-dark">
        <Text className="text-title font-semibold tabular-nums text-muted-light dark:text-muted-dark">
          {transaction.amount === null ? 'Unknown' : formatVnd(transaction.amount)}
        </Text>
        <Text className="text-body text-muted-light dark:text-muted-dark">{effect}</Text>
        <Text className="text-detail text-muted-light dark:text-muted-dark">
          {account?.name ?? 'Account'} · {dateLabel(transaction.occurredAt)}
        </Text>
        {transaction.note ? <Text className="text-body text-muted-light dark:text-muted-dark">{transaction.note}</Text> : null}
      </View>

      <Text className="text-body text-muted-light dark:text-muted-dark">
        Adjustments do not count as spending or income. To make another correction, use Accounts and reconcile.
      </Text>
      <Button onPress={onDone}>Back to transactions</Button>
      <HomeRouteLink />
    </View>
  );
}
