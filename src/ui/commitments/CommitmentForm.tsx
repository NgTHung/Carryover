/** Controlled fields shared by commitment creation and editing. */
import { Text, View } from 'react-native';

import { Button } from '../Button';
import { Input } from '../Input';
import type {
  CommitmentFormErrors,
  CommitmentFormValues,
  ReserveLeafChoice,
} from './commitment-form';

export function CommitmentForm({
  values,
  choices,
  errors,
  disabled,
  submitLabel,
  unavailableLeafLabel,
  onChange,
  onSubmit,
  onCancel,
}: {
  values: CommitmentFormValues;
  choices: readonly ReserveLeafChoice[];
  errors: CommitmentFormErrors;
  disabled: boolean;
  submitLabel: string;
  unavailableLeafLabel?: string;
  onChange: (values: CommitmentFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <View className="gap-3 rounded-surface border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark">
      <Input
        label="Commitment name"
        value={values.name}
        error={errors.name}
        editable={!disabled}
        onChangeText={(name) => onChange({ ...values, name })}
      />
      <Input
        label="Reserve amount"
        value={values.amount}
        error={errors.amount}
        editable={!disabled}
        inputMode="numeric"
        onChangeText={(amount) => onChange({ ...values, amount })}
      />
      <Input
        label="Due day"
        value={values.dueDay}
        error={errors.dueDay}
        editable={!disabled}
        inputMode="numeric"
        onChangeText={(dueDay) => onChange({ ...values, dueDay })}
      />
      <View className="gap-2">
        <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">
          Reserve leaf
        </Text>
        {unavailableLeafLabel ? (
          <Text className="text-detail text-error-light dark:text-error-dark">
            {unavailableLeafLabel} is unavailable. Choose an active reserve leaf to keep this commitment active.
          </Text>
        ) : null}
        {choices.map((choice) => (
          <Button
            key={choice.id}
            variant={values.categoryId === choice.id ? 'primary' : 'secondary'}
            disabled={disabled}
            fullWidth
            onPress={() => onChange({ ...values, categoryId: choice.id })}
          >
            {choice.groupName} / {choice.name}
          </Button>
        ))}
        {errors.leaf ? (
          <Text className="text-detail text-error-light dark:text-error-dark">
            {errors.leaf}
          </Text>
        ) : null}
      </View>
      {errors.form ? (
        <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
          {errors.form}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        <Button disabled={disabled} onPress={onSubmit}>{submitLabel}</Button>
        <Button variant="secondary" disabled={disabled} onPress={onCancel}>Cancel</Button>
      </View>
    </View>
  );
}
