/** Controlled account details fields kept local until the save succeeds. */
import { Text, View } from 'react-native';

import { Button, Input } from '../index';

export function AccountDetailsForm({
  accountLabel,
  accountName,
  openingBalance,
  error,
  disabled,
  onNameChange,
  onOpeningBalanceChange,
  onSave,
  onCancel,
}: {
  accountLabel: string;
  accountName: string;
  openingBalance: string;
  error?: string;
  disabled: boolean;
  onNameChange: (value: string) => void;
  onOpeningBalanceChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <View className="gap-3">
      <Input
        label="Account name"
        value={accountName}
        editable={!disabled}
        autoCapitalize="words"
        autoCorrect={false}
        onChangeText={onNameChange}
      />
      <Input
        label="Opening balance"
        value={openingBalance}
        editable={!disabled}
        keyboardType="number-pad"
        onChangeText={onOpeningBalanceChange}
      />
      <Text className="text-detail text-muted-light dark:text-muted-dark">
        Your opening balance is what you held before recorded transactions. Changing it changes balances calculated from your ledger, including past balances. Saved period opening balances and reserves stay the same. To correct what you hold today, use Reconcile.
      </Text>
      {error ? (
        <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
          {error}
        </Text>
      ) : null}
      <View className="gap-2">
        <Button
          fullWidth
          disabled={disabled}
          accessibilityLabel={`Save details for ${accountLabel}`}
          onPress={onSave}
        >
          {disabled ? 'Saving…' : 'Save details'}
        </Button>
        <Button
          fullWidth
          variant="secondary"
          disabled={disabled}
          accessibilityLabel={`Cancel editing ${accountLabel}`}
          onPress={onCancel}
        >
          Cancel
        </Button>
      </View>
    </View>
  );
}
