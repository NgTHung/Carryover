import { Text, View } from 'react-native';

import type { TransactionListRow } from '../../data/transaction-list';
import { QualityChip } from '../QualityChip';
import { Button } from '../Button';
import { PeriodSelector } from '../PeriodSelector';
import type { TransactionFilterStore } from './transaction-filters';

type Choice = { id: string; label: string };

function ChoiceButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      size="compact"
      variant={selected ? 'primary' : 'secondary'}
      accessibilityState={{ selected }}
      onPress={onPress}
    >
      {label}
    </Button>
  );
}

function uniqueChoices(values: Choice[]): Choice[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value.id)) return false;
    seen.add(value.id);
    return true;
  });
}

export function TransactionListFilters({
  rows,
  filters,
}: {
  rows: TransactionListRow[];
  filters: TransactionFilterStore;
}) {
  const categories = uniqueChoices(
    rows.flatMap((row) =>
      row.kind === 'transaction' && row.category
        ? [{ id: row.category.id, label: row.category.name }]
        : []
    )
  );
  const accounts = uniqueChoices(
    rows.flatMap((row) => {
      if (row.kind === 'transaction' || (row.kind === 'transfer' && row.source === 'transaction')) {
        return [{ id: row.account.id, label: row.account.name }];
      }
      return [
        { id: row.fromAccount.id, label: row.fromAccount.name },
        { id: row.toAccount.id, label: row.toAccount.name },
      ];
    })
  );

  return (
    <View className="gap-3 rounded-surface border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark">
      <PeriodSelector period={filters.selectedPeriod} onChange={filters.setSelectedPeriod} />

      <Text className="text-detail font-semibold text-muted-light dark:text-muted-dark">Leaf</Text>
      <View className="flex-row flex-wrap gap-2">
        <ChoiceButton label="All leaves" selected={filters.categoryId === null} onPress={() => filters.setCategoryId(null)} />
        {categories.map((choice) => (
          <ChoiceButton
            key={choice.id}
            label={choice.label}
            selected={filters.categoryId === choice.id}
            onPress={() => filters.setCategoryId(choice.id)}
          />
        ))}
      </View>

      <Text className="text-detail font-semibold text-muted-light dark:text-muted-dark">Account</Text>
      <View className="flex-row flex-wrap gap-2">
        <ChoiceButton label="All accounts" selected={filters.accountId === null} onPress={() => filters.setAccountId(null)} />
        {accounts.map((choice) => (
          <ChoiceButton
            key={choice.id}
            label={choice.label}
            selected={filters.accountId === choice.id}
            onPress={() => filters.setAccountId(choice.id)}
          />
        ))}
      </View>

      <Text className="text-detail font-semibold text-muted-light dark:text-muted-dark">Quality</Text>
      <View className="flex-row flex-wrap gap-2">
        <ChoiceButton label="All quality" selected={filters.quality === null} onPress={() => filters.setQuality(null)} />
        {(['need', 'want', 'regret'] as const).map((quality) => (
          <QualityChip
            key={quality}
            quality={quality}
            selected={filters.quality === quality}
            onPress={() => filters.setQuality(quality)}
          />
        ))}
        <ChoiceButton label="Unrated" selected={filters.quality === 'unrated'} onPress={() => filters.setQuality('unrated')} />
      </View>
    </View>
  );
}
