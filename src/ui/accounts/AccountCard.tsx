/** Renders one account identity, projection, and its active form. */
import { Text, View } from 'react-native';

import type { AccountBalance } from '../../data/accounts';
import { formatVnd } from '../../money/currency';
import { Button, Input } from '../index';
import { AccountDetailsForm } from './AccountDetailsForm';
import type { AccountInteraction } from './account-form-state';

function kindLabel(account: AccountBalance): string {
  return account.kind === 'bank' ? 'Bank account' : 'Cash account';
}

function reconcilePrompt(account: AccountBalance): string {
  return account.kind === 'cash'
    ? "What's actually in your wallet?"
    : "What's actually in your bank account?";
}

export function AccountCard({
  account,
  interaction,
  feedback,
  formDisabled,
  onEditDetails,
  onReconcile,
  onNameChange,
  onOpeningBalanceChange,
  onSaveDetails,
  onCancelDetails,
  onStatedBalanceChange,
  onSaveReconcile,
  onCancelReconcile,
}: {
  account: AccountBalance;
  interaction: AccountInteraction;
  feedback?: string;
  formDisabled: boolean;
  onEditDetails: () => void;
  onReconcile: () => void;
  onNameChange: (value: string) => void;
  onOpeningBalanceChange: (value: string) => void;
  onSaveDetails: () => void;
  onCancelDetails: () => void;
  onStatedBalanceChange: (value: string) => void;
  onSaveReconcile: () => void;
  onCancelReconcile: () => void;
}) {
  const isDetailsForm =
    interaction.status === 'editing-details' ||
    interaction.status === 'saving-details';
  const isReconcileForm =
    interaction.status === 'reconciling' ||
    interaction.status === 'saving-reconcile';
  const isCurrentAccount =
    interaction.status !== 'closed' && interaction.accountId === account.accountId;
  const isSaving =
    interaction.status === 'saving-details' ||
    interaction.status === 'saving-reconcile';
  const detailsError = isDetailsForm && isCurrentAccount && interaction.status === 'editing-details'
    ? interaction.error
    : undefined;
  const reconcileError = isReconcileForm && isCurrentAccount && interaction.status === 'reconciling'
    ? interaction.error
    : undefined;

  return (
    <View
      className="gap-3 rounded-surface border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">
            {account.name}
          </Text>
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-detail uppercase text-muted-light dark:text-muted-dark">
              {kindLabel(account)}
            </Text>
            {account.isDefault ? (
              <Text accessibilityLabel={`${account.name} is the default account`} className="text-detail font-semibold text-need-light dark:text-need-dark">
                Default
              </Text>
            ) : null}
          </View>
        </View>
        <Text
          accessibilityLabel={`${account.name} current balance ${formatVnd(account.balance)}`}
          className="text-body font-semibold tabular-nums text-ink-light dark:text-ink-dark"
        >
          {formatVnd(account.balance)}
        </Text>
      </View>

      {!isDetailsForm ? (
        <Text className="text-body text-muted-light dark:text-muted-dark">
          {reconcilePrompt(account)}
        </Text>
      ) : null}

      {isCurrentAccount && isDetailsForm ? (
        <AccountDetailsForm
          accountLabel={account.name}
          accountName={interaction.status === 'saving-details' ? interaction.name : interaction.name}
          openingBalance={interaction.status === 'saving-details' ? interaction.openingBalance : interaction.openingBalance}
          error={detailsError}
          disabled={isSaving}
          onNameChange={onNameChange}
          onOpeningBalanceChange={onOpeningBalanceChange}
          onSave={onSaveDetails}
          onCancel={onCancelDetails}
        />
      ) : null}

      {isCurrentAccount && isReconcileForm ? (
        <View className="gap-3">
          <Input
            label="Actual balance"
            value={interaction.status === 'saving-reconcile' ? interaction.statedBalance : interaction.statedBalance}
            keyboardType="number-pad"
            error={reconcileError}
            editable={!isSaving}
            onChangeText={onStatedBalanceChange}
          />
          <View className="flex-row gap-2">
            <Button
              disabled={isSaving}
              accessibilityLabel={`Reconcile ${account.name}`}
              onPress={onSaveReconcile}
            >
              {isSaving ? 'Saving…' : 'Reconcile'}
            </Button>
            <Button
              variant="secondary"
              disabled={isSaving}
              accessibilityLabel={`Cancel reconciling ${account.name}`}
              onPress={onCancelReconcile}
            >
              Cancel
            </Button>
          </View>
        </View>
      ) : null}

      {!isCurrentAccount ? (
        <View className="flex-row flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={formDisabled}
            accessibilityLabel={`Edit details for ${account.name}`}
            onPress={onEditDetails}
          >
            Edit details
          </Button>
          <Button
            variant="secondary"
            disabled={formDisabled}
            accessibilityLabel={`Reconcile ${account.name}`}
            onPress={onReconcile}
          >
            Reconcile
          </Button>
        </View>
      ) : null}

      {feedback ? (
        <Text accessibilityRole="alert" className="text-detail text-muted-light dark:text-muted-dark">
          {feedback}
        </Text>
      ) : null}
    </View>
  );
}
