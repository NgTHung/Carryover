import { Text, View } from 'react-native';

import { formatVnd } from '../../money/currency';
import type {
  HistoryTransaction,
  PeriodHistoryDay,
} from '../../reports/period-history-types';

export function calendarDateLabel(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function transactionAccessibilityLabel(transaction: HistoryTransaction): string {
  const amount = transaction.amount === null ? 'Unknown amount' : formatVnd(transaction.amount);
  const draft = transaction.status === 'draft' ? ', Draft' : '';
  return transaction.direction === 'income'
    ? `${amount}, Income${draft}`
    : `${amount}, ${transaction.label}${draft}`;
}

function transactionTitle(transaction: HistoryTransaction): string {
  if (transaction.amount === null) return `${transaction.label}, amount unknown`;
  return transaction.direction === 'income' ? 'Income' : transaction.label;
}

export function DayTransactions({ day }: { day: PeriodHistoryDay }) {
  return (
    <View
      className="gap-2 rounded-surface border border-faint-light bg-ground-light p-3 dark:border-faint-dark dark:bg-ground-dark"
      testID={`summary-day-details-${day.day}`}
    >
      <Text accessibilityRole="header" className="text-body font-semibold text-ink-light dark:text-ink-dark">
        {calendarDateLabel(day.date)}
      </Text>
      {day.transactions.length === 0 ? (
        <Text className="text-detail text-muted-light dark:text-muted-dark">
          {day.unknownDrafts > 0
            ? `${day.unknownDrafts} unknown ${day.unknownDrafts === 1 ? 'draft' : 'drafts'} not included in known amounts.`
            : 'No transactions recorded.'}
        </Text>
      ) : (
        day.transactions.map((transaction) => (
          <View
            key={transaction.id}
            accessible
            accessibilityLabel={transactionAccessibilityLabel(transaction)}
            className="flex-row items-baseline justify-between gap-3"
          >
            <Text className="flex-1 text-detail text-muted-light dark:text-muted-dark">
              {transactionTitle(transaction)}
            </Text>
            <Text className="text-detail tabular-nums text-ink-light dark:text-ink-dark">
              {transaction.amount === null ? 'Unknown' : formatVnd(transaction.amount)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}
