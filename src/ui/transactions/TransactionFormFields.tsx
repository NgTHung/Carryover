/**
 * Controlled fields shared by the manual creator and transaction editor.
 *
 * This component only presents values and sends updates upward. It owns no
 * persistence or navigation, so a failed write can leave every field intact.
 */
import { Text, View } from 'react-native';

import type { ActiveAccount } from '../../data/accounts';
import type { CategoryGroupWithLeaves } from '../../data/category-types';
import { Button, Input, QualityChip } from '../index';
import type {
  TransactionFormErrors,
  TransactionFormValues,
} from './transaction-form';
import { transitionDirection } from './transaction-form';

export type TransactionFormPresentation =
  | { kind: 'editable' }
  | { kind: 'fixed-expense'; leafName: string };

function Choice({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      size="compact"
      variant={selected ? 'primary' : 'secondary'}
      accessibilityState={{ selected }}
      disabled={disabled}
      onPress={onPress}
    >
      {label}
    </Button>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
      {message}
    </Text>
  ) : null;
}

export function TransactionFormFields({
  values,
  groups,
  accounts,
  errors,
  disabled,
  presentation,
  onChange,
}: {
  values: TransactionFormValues;
  groups: CategoryGroupWithLeaves[];
  accounts: ActiveAccount[];
  errors: TransactionFormErrors;
  disabled: boolean;
  presentation: TransactionFormPresentation;
  onChange: (values: TransactionFormValues) => void;
}) {
  const update = (changes: Partial<TransactionFormValues>) => {
    onChange({ ...values, ...changes });
  };

  return (
    <>
      <Input
        label="Amount"
        keyboardType="number-pad"
        value={values.amount}
        error={errors.amount}
        editable={!disabled}
        onChangeText={(amount) => update({ amount })}
      />

      {presentation.kind === 'editable' ? (
        <View className="gap-2">
          <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Direction</Text>
          <View className="flex-row flex-wrap gap-2">
            {(['expense', 'income'] as const).map((direction) => (
              <Choice
                key={direction}
                label={direction}
                selected={values.direction === direction}
                disabled={disabled}
                onPress={() => onChange(transitionDirection(values, direction))}
              />
            ))}
          </View>
        </View>
      ) : (
        <View className="gap-1 rounded-surface border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark">
          <Text className="text-detail text-muted-light dark:text-muted-dark">Expense leaf</Text>
          <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">
            {presentation.leafName}
          </Text>
        </View>
      )}

      {values.direction === 'expense' && presentation.kind === 'editable' ? (
        <View className="gap-2">
          <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Leaf</Text>
          <View className="flex-row flex-wrap gap-2">
            {groups.flatMap((group) => group.leaves).map((leaf) => (
              <Choice
                key={leaf.id}
                label={leaf.name}
                selected={values.categoryId === leaf.id}
                disabled={disabled}
                onPress={() => update({ categoryId: leaf.id })}
              />
            ))}
          </View>
          <FieldError message={errors.leaf} />
        </View>
      ) : (
        <FieldError message={errors.leaf} />
      )}

      {values.direction === 'income' ? (
        <Input
          label="Source"
          value={values.sourceLabel}
          editable={!disabled}
          onChangeText={(sourceLabel) => update({ sourceLabel })}
        />
      ) : null}

      <View className="gap-2">
        <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Account</Text>
        <View className="flex-row flex-wrap gap-2">
          {accounts.map((account) => (
            <Choice
              key={account.accountId}
              label={account.name}
              selected={values.accountId === account.accountId}
              disabled={disabled}
              onPress={() => update({ accountId: account.accountId })}
            />
          ))}
        </View>
        <FieldError message={errors.account} />
      </View>

      <View className="gap-2">
        <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Quality</Text>
        <View className="flex-row flex-wrap gap-2">
          {(['need', 'want', 'regret'] as const).map((quality) => (
            <QualityChip
              key={quality}
              quality={quality}
              selected={values.quality === quality}
              disabled={disabled}
              onPress={() => update({ quality: values.quality === quality ? null : quality })}
            />
          ))}
        </View>
      </View>

      <Input
        label="Date"
        value={values.date}
        error={errors.date}
        editable={!disabled}
        autoCapitalize="none"
        onChangeText={(date) => update({ date })}
      />
      <Input
        label="Note"
        value={values.note}
        editable={!disabled}
        multiline
        onChangeText={(note) => update({ note })}
      />
    </>
  );
}
