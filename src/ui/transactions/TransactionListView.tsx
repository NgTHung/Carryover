import { FlatList, Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';

import type { TransactionListRow as TransactionListItem } from '../../data/transaction-list';
import { Button } from '../Button';
import { TransactionListFilters } from './TransactionListFilters';
import { TransactionListRow, transactionListRowId } from './TransactionListRow';
import { adjustmentEffectLabel } from './adjustment';
import type { TransactionFilterStore } from './transaction-filters';

export type TransactionListLoadState =
  | { status: 'loading' }
  | { status: 'ready'; rows: TransactionListItem[] }
  | { status: 'error'; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function Header({
  rows,
  filters,
  onReset,
}: {
  rows: TransactionListItem[];
  filters: TransactionFilterStore;
  onReset: () => void;
}) {
  const hasFilters = filters.categoryId !== null || filters.accountId !== null || filters.quality !== null;
  return (
    <View className="gap-4 bg-ground-light px-5 pb-4 pt-16 dark:bg-ground-dark">
      <View className="gap-1">
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">Transactions</Text>
      </View>
      <TransactionListFilters rows={rows} filters={filters} />
      {hasFilters ? <Button variant="secondary" fullWidth onPress={onReset}>Reset filters</Button> : null}
    </View>
  );
}

export function TransactionListView({
  state,
  optionRows,
  filters,
  onReset,
  onRetry,
}: {
  state: TransactionListLoadState;
  optionRows: TransactionListItem[];
  filters: TransactionFilterStore;
  onReset: () => void;
  onRetry: () => void;
}) {
  if (state.status === 'loading') {
    return <Message title="Transactions" detail="Loading transactions…" />;
  }

  if (state.status === 'error') {
    return (
      <View className="flex-1 gap-3 bg-ground-light px-5 py-16 dark:bg-ground-dark">
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">Transactions</Text>
        <Text accessibilityRole="alert" className="text-body text-error-light dark:text-error-dark">{state.message}</Text>
        <Button onPress={onRetry}>Try again</Button>
      </View>
    );
  }

  return (
    <FlatList
      testID="transaction-list"
      data={state.rows}
      keyExtractor={transactionListRowId}
      contentContainerClassName="gap-2 bg-ground-light pb-16 dark:bg-ground-dark"
      ListHeaderComponent={<Header rows={optionRows} filters={filters} onReset={onReset} />}
      ListEmptyComponent={
        <View className="gap-3 px-5 py-8">
          <Text className="text-body text-muted-light dark:text-muted-dark">
            {filters.categoryId !== null || filters.accountId !== null || filters.quality !== null
              ? 'No transactions match these filters.'
              : 'No transactions in this period.'}
          </Text>
          {filters.categoryId !== null || filters.accountId !== null || filters.quality !== null ? (
            <Button variant="secondary" onPress={onReset}>Reset filters</Button>
          ) : null}
        </View>
      }
      renderItem={({ item }) => {
        if (item.kind === 'transfer') {
          return <TransactionListRow row={item} />;
        }
        return (
          <Link href={`/transactions/${item.transaction.id}`} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                item.transaction.direction === 'adjustment'
                  ? `Open adjustment, ${adjustmentEffectLabel(item.transaction) ?? 'Balance adjustment'}, ${item.transaction.occurredAt.toISOString()}`
                  : `Open ${item.transaction.direction} transaction from ${item.transaction.occurredAt.toISOString()}`
              }
              className="min-h-touch active:opacity-80"
            >
              <TransactionListRow row={item} />
            </Pressable>
          </Link>
        );
      }}
    />
  );
}

function Message({ title, detail }: { title: string; detail: string }) {
  return (
    <View className="flex-1 gap-2 bg-ground-light px-5 py-16 dark:bg-ground-dark">
      <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">{title}</Text>
      <Text className="text-body text-muted-light dark:text-muted-dark">{detail}</Text>
    </View>
  );
}

export { errorMessage };
