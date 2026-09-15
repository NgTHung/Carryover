import { Text, View } from 'react-native';
import { formatVnd } from '../../money/currency';
import type { TransactionListRow as TransactionListItem } from '../../data/transaction-list';
import { adjustmentEffectLabel } from './adjustment';

function dateLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function amountLabel(amount: number | null): string {
  return amount === null ? 'Unknown' : formatVnd(amount);
}

function transactionDetail(row: Extract<TransactionListItem, { kind: 'transaction' }>): string {
  const { transaction } = row;
  if (transaction.direction === 'adjustment') {
    return adjustmentEffectLabel(transaction) ?? 'Balance adjustment';
  }
  if (transaction.direction === 'income') {
    return transaction.sourceLabel ?? 'Income';
  }
  return row.category?.name ?? 'No leaf category';
}

export function transactionListRowAccessibilityLabel(row: TransactionListItem): string {
  if (row.kind === 'transaction') {
    const { transaction } = row;
    const status = transaction.status === 'draft' ? ', Draft' : '';
    const adjustment = adjustmentEffectLabel(transaction);
    return `${amountLabel(transaction.amount)}, ${adjustment ?? transaction.direction}, ${transactionDetail(row)}, ${row.account.name}, ${transaction.quality ?? 'Unrated'}, ${dateLabel(transaction.occurredAt)}${status}`;
  }

  if (row.source === 'transaction') {
    return `${amountLabel(row.transaction.amount)}, Transfer, ${row.account.name}, ${dateLabel(row.transaction.occurredAt)}`;
  }

  return `${formatVnd(row.transfer.amount)}, Transfer, ${row.fromAccount.name} to ${row.toAccount.name}, ${dateLabel(row.transfer.occurredAt)}`;
}

export function transactionListRowId(row: TransactionListItem): string {
  return row.kind === 'transfer' && row.source === 'transfers'
    ? row.transfer.id
    : row.transaction.id;
}

export function transactionListRowDate(row: TransactionListItem): Date {
  return row.kind === 'transfer' && row.source === 'transfers'
    ? row.transfer.occurredAt
    : row.transaction.occurredAt;
}

export function TransactionListRow({ row }: { row: TransactionListItem }) {
  if (row.kind === 'transaction') {
    const { transaction } = row;
    const adjustment = adjustmentEffectLabel(transaction);
    if (transaction.direction === 'adjustment') {
      return (
        <View
          accessible
          accessibilityLabel={transactionListRowAccessibilityLabel(row)}
          className="gap-1 rounded-surface border border-faint-light bg-ground-light p-4 opacity-75 dark:border-faint-dark dark:bg-ground-dark"
        >
          <View className="flex-row items-start justify-between gap-3">
            <Text className="flex-1 text-body font-semibold tabular-nums text-muted-light dark:text-muted-dark">
              {amountLabel(transaction.amount)}
            </Text>
            <Text className="text-detail font-semibold uppercase text-muted-light dark:text-muted-dark">Adjustment</Text>
          </View>
          <Text className="text-body text-muted-light dark:text-muted-dark">{adjustment ?? 'Balance adjustment'}</Text>
          <Text className="text-detail text-muted-light dark:text-muted-dark">
            {row.account.name} · {dateLabel(transaction.occurredAt)}
          </Text>
        </View>
      );
    }
    return (
      <View
        accessible
        accessibilityLabel={transactionListRowAccessibilityLabel(row)}
        className="gap-1 rounded-surface border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark"
      >
        <View className="flex-row items-start justify-between gap-3">
          <Text className="flex-1 text-body font-semibold tabular-nums text-ink-light dark:text-ink-dark">
            {amountLabel(transaction.amount)}
          </Text>
          <Text className="text-detail font-semibold uppercase text-muted-light dark:text-muted-dark">
            {transaction.direction}
          </Text>
        </View>
        <Text className="text-body text-ink-light dark:text-ink-dark">
          {transactionDetail(row)}
        </Text>
        <Text className="text-detail text-muted-light dark:text-muted-dark">
          {row.account.name} · {transaction.quality ?? 'Unrated'} · {dateLabel(transaction.occurredAt)}
        </Text>
        {transaction.status === 'draft' ? (
          <Text className="text-detail font-semibold text-want-light dark:text-want-dark">Draft</Text>
        ) : null}
      </View>
    );
  }

  if (row.source === 'transaction') {
    return (
      <View
        accessible
        accessibilityLabel={transactionListRowAccessibilityLabel(row)}
        className="gap-1 rounded-surface border border-faint-light bg-ground-light p-4 dark:border-faint-dark dark:bg-ground-dark"
      >
        <View className="flex-row items-start justify-between gap-3">
          <Text className="flex-1 text-body font-semibold tabular-nums text-ink-light dark:text-ink-dark">
            {amountLabel(row.transaction.amount)}
          </Text>
          <Text className="text-detail font-semibold uppercase text-muted-light dark:text-muted-dark">Transfer</Text>
        </View>
        <Text className="text-body text-ink-light dark:text-ink-dark">{row.account.name}</Text>
        <Text className="text-detail text-muted-light dark:text-muted-dark">
          {dateLabel(row.transaction.occurredAt)}
        </Text>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={transactionListRowAccessibilityLabel(row)}
      className="gap-1 rounded-surface border border-faint-light bg-ground-light p-4 dark:border-faint-dark dark:bg-ground-dark"
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-body font-semibold tabular-nums text-ink-light dark:text-ink-dark">
          {formatVnd(row.transfer.amount)}
        </Text>
        <Text className="text-detail font-semibold uppercase text-muted-light dark:text-muted-dark">Transfer</Text>
      </View>
      <Text className="text-body text-ink-light dark:text-ink-dark">
        {row.fromAccount.name} → {row.toAccount.name}
      </Text>
      <Text className="text-detail text-muted-light dark:text-muted-dark">
        {dateLabel(row.transfer.occurredAt)}
      </Text>
    </View>
  );
}
