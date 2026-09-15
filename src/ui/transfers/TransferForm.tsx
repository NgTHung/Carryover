/** Controlled transfer form with retryable writes and a terminal saved state. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { ActiveAccount } from '../../data/accounts';
import { Button, Input } from '../index';
import type { TransferCreationData } from './transfer-data-contract';
import {
  accountChoiceLabel,
  buildTransferPayload,
  initializeTransferForm,
  selectFromAccount,
  selectToAccount,
  validateTransferForm,
  type TransferFormErrors,
  type TransferFormValues,
} from './transfer-form';

type TransferMutation =
  | { status: 'editing' }
  | { status: 'saving' }
  | { status: 'failed'; message: string }
  | { status: 'saved' };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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

export function TransferForm({
  accounts,
  openedAt,
  data,
  onCancel,
  onCommitted,
  onWritePending,
  navigationError,
  onRetryNavigation,
  navigationActionLabel = 'Back to accounts',
  now = () => new Date(),
}: {
  accounts: ActiveAccount[];
  openedAt: Date;
  data: TransferCreationData;
  onCancel: () => void;
  onCommitted: () => void;
  onWritePending?: (pending: boolean) => void;
  navigationError?: string;
  onRetryNavigation?: () => void;
  navigationActionLabel?: string;
  now?: () => Date;
}) {
  const initialization = useMemo(
    () => initializeTransferForm(accounts, openedAt),
    [accounts, openedAt]
  );
  const [form, setForm] = useState<TransferFormValues | undefined>(
    initialization.status === 'ready' ? initialization.values : undefined
  );
  const [errors, setErrors] = useState<TransferFormErrors>({});
  const [mutation, setMutation] = useState<TransferMutation>({ status: 'editing' });
  const submissionLockedRef = useRef(false);
  const committedRef = useRef(false);

  useEffect(() => {
    if (form === undefined && initialization.status === 'ready') {
      setForm(initialization.values);
    }
  }, [form, initialization]);

  if (form === undefined || initialization.status === 'error') {
    return (
      <View className="flex-1 gap-3 bg-ground-light px-5 py-16 dark:bg-ground-dark">
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          Cannot record transfer
        </Text>
        <Text accessibilityRole="alert" className="text-body text-error-light dark:text-error-dark">
          {initialization.status === 'error' ? initialization.message : 'The transfer form could not initialize.'}
        </Text>
        <Button variant="secondary" onPress={onCancel}>Back to accounts</Button>
      </View>
    );
  }

  const saving = mutation.status === 'saving';
  const saved = mutation.status === 'saved';

  const submit = async () => {
    if (saving || saved || submissionLockedRef.current) return;
    const validation = validateTransferForm(form, accounts, openedAt, now());
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    submissionLockedRef.current = true;
    onWritePending?.(true);
    setErrors({});
    setMutation({ status: 'saving' });
    try {
      await data.recordTransfer(buildTransferPayload(form, validation));
    } catch (error: unknown) {
      setMutation({ status: 'failed', message: errorMessage(error) });
      submissionLockedRef.current = false;
      onWritePending?.(false);
      return;
    }

    setMutation({ status: 'saved' });
    onWritePending?.(false);
    if (!committedRef.current) {
      committedRef.current = true;
      onCommitted();
    }
  };

  const cancel = () => {
    if (submissionLockedRef.current || saved) return;
    onCancel();
  };

  const updateForm = (next: TransferFormValues) => {
    setForm(next);
    setErrors({});
    if (mutation.status === 'failed') setMutation({ status: 'editing' });
  };

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentContainerClassName="gap-5 bg-ground-light px-5 pb-16 pt-16 dark:bg-ground-dark"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-1">
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          Record transfer
        </Text>
        <Text className="text-body text-muted-light dark:text-muted-dark">
          Moving money between your accounts does not count as spending or income.
        </Text>
      </View>

      {mutation.status === 'failed' ? (
        <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
          Could not record transfer. {mutation.message} Try again.
        </Text>
      ) : null}
      {navigationError ? (
        <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
          {navigationError}
        </Text>
      ) : null}

      {saved ? (
        <View className="gap-3 rounded-surface border border-need-light p-4 dark:border-need-dark">
          <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Transfer recorded.</Text>
          <Text className="text-body text-muted-light dark:text-muted-dark">
            Moving money between your accounts does not count as spending or income.
          </Text>
          {onRetryNavigation ? (
            <Button variant="secondary" onPress={onRetryNavigation}>{navigationActionLabel}</Button>
          ) : null}
        </View>
      ) : (
        <>
          <Input
            label="Amount"
            keyboardType="number-pad"
            value={form.amount}
            error={errors.amount}
            editable={!saving}
            onChangeText={(amount) => updateForm({ ...form, amount })}
          />

          <View className="gap-2">
            <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">From</Text>
            <View className="flex-row flex-wrap gap-2">
              {accounts.map((account) => (
                <Choice
                  key={`from-${account.accountId}`}
                  label={`From: ${accountChoiceLabel(account)}`}
                  selected={form.fromAccountId === account.accountId}
                  disabled={saving}
                  onPress={() => updateForm(selectFromAccount(form, account.accountId))}
                />
              ))}
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">To</Text>
            <View className="flex-row flex-wrap gap-2">
              {accounts.map((account) => (
                <Choice
                  key={`to-${account.accountId}`}
                  label={`To: ${accountChoiceLabel(account)}`}
                  selected={form.toAccountId === account.accountId}
                  disabled={saving}
                  onPress={() => updateForm(selectToAccount(form, account.accountId))}
                />
              ))}
            </View>
            <FieldError message={errors.accounts} />
          </View>

          <Input
            label="Date"
            value={form.date}
            error={errors.date}
            editable={!saving}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            placeholder="YYYY-MM-DD"
            onChangeText={(date) => updateForm({ ...form, date })}
          />
          <Text className="text-detail text-muted-light dark:text-muted-dark">Format: YYYY-MM-DD</Text>
          <FieldError message={errors.form} />

          <View className="gap-2">
            <Button fullWidth disabled={saving} onPress={() => void submit()}>Record transfer</Button>
            <Button variant="secondary" fullWidth disabled={saving} onPress={cancel}>Cancel</Button>
          </View>
        </>
      )}
    </ScrollView>
  );
}
