import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { nonNegativeVndInputSchema } from '../../data/money-validation';
import type { AccountBalance } from '../../data/accounts';
import { formatVnd } from '../../money/currency';
import { Button, Input } from '../index';
import type { AccountReconcileData } from './account-reconcile-contract';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; accounts: AccountBalance[] }
  | { status: 'error'; message: string };

type FormState =
  | { status: 'closed' }
  | { status: 'open'; value: string; error?: string }
  | { status: 'submitting'; value: string };

type Feedback =
  | { status: 'adjusted'; accountId: string }
  | { status: 'unchanged'; accountId: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseWholeVnd(value: string): number | undefined {
  const parsed = nonNegativeVndInputSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function promptFor(account: AccountBalance): string {
  return account.kind === 'cash'
    ? "What's actually in your wallet?"
    : "What's actually in your bank account?";
}

export function AccountReconcileScreen({
  data,
}: {
  data: AccountReconcileData;
}) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [feedback, setFeedback] = useState<Feedback | undefined>();

  const load = useCallback(async () => {
    try {
      const accounts = await data.readAccountBalances();
      setLoadState({ status: 'ready', accounts });
    } catch (error: unknown) {
      setLoadState({ status: 'error', message: errorMessage(error) });
    }
  }, [data]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateForm = useCallback((accountId: string, form: FormState) => {
    setForms((current) => ({ ...current, [accountId]: form }));
  }, []);

  const reconcile = useCallback(
    async (account: AccountBalance) => {
      const form = forms[account.accountId];
      if (form?.status !== 'open') return;
      const actualBalance = parseWholeVnd(form.value);
      if (actualBalance === undefined) {
        updateForm(account.accountId, {
          status: 'open',
          value: form.value,
          error: 'Enter a whole, nonnegative VND amount.',
        });
        return;
      }

      updateForm(account.accountId, { status: 'submitting', value: form.value });
      setFeedback(undefined);
      try {
        const result = await data.reconcileAccount({
          accountId: account.accountId,
          statedBalance: actualBalance,
          occurredAt: new Date(),
        });
        await load();
        setFeedback({ status: result.status, accountId: account.accountId });
        updateForm(account.accountId, { status: 'closed' });
      } catch (error: unknown) {
        updateForm(account.accountId, {
          status: 'open',
          value: form.value,
          error: errorMessage(error),
        });
      }
    },
    [data, forms, load, updateForm]
  );

  if (loadState.status === 'loading') {
    return <Message title="Accounts" detail="Loading account balances…" />;
  }

  if (loadState.status === 'error') {
    return (
      <View className="flex-1 gap-3 bg-ground-light px-5 py-16 dark:bg-ground-dark">
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          Accounts
        </Text>
        <Text accessibilityRole="alert" className="text-body text-error-light dark:text-error-dark">
          {loadState.message}
        </Text>
        <Button onPress={() => void load()}>Try again</Button>
      </View>
    );
  }

  return (
    <ScrollView
      testID="accounts-screen"
      contentContainerClassName="gap-5 bg-ground-light px-5 pb-16 pt-16 dark:bg-ground-dark"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-1">
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">
          SETTINGS
        </Text>
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          Accounts and reconcile
        </Text>
        <Text className="text-body text-muted-light dark:text-muted-dark">
          State what you actually hold when a balance drifts. Reconcile is routine maintenance and leaves a visible adjustment in the ledger.
        </Text>
      </View>

      {loadState.accounts.map((account) => {
        const form = forms[account.accountId] ?? { status: 'closed' as const };
        const activeForm = form.status === 'closed'
          ? { status: 'open' as const, value: '' }
          : form;
        const isOpen = form.status !== 'closed';
        const isSubmitting = form.status === 'submitting';
        const accountFeedback = feedback?.accountId === account.accountId ? feedback : undefined;
        return (
          <View
            key={account.accountId}
            className="gap-3 rounded-surface border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark"
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">{account.name}</Text>
                <Text className="text-detail uppercase text-muted-light dark:text-muted-dark">{account.kind}</Text>
              </View>
              <Text accessibilityLabel={`${account.name} current balance ${formatVnd(account.balance)}`} className="text-body font-semibold tabular-nums text-ink-light dark:text-ink-dark">
                {formatVnd(account.balance)}
              </Text>
            </View>
            <Text className="text-body text-muted-light dark:text-muted-dark">{promptFor(account)}</Text>

            {isOpen ? (
              <>
                <Input
                  label="Actual balance"
                  keyboardType="number-pad"
                  value={activeForm.value}
                  error={activeForm.status === 'open' ? activeForm.error : undefined}
                  editable={!isSubmitting}
                  onChangeText={(value) => updateForm(account.accountId, { status: 'open', value })}
                />
                <View className="flex-row gap-2">
                  <Button disabled={isSubmitting} onPress={() => void reconcile(account)}>
                    {isSubmitting ? 'Saving…' : 'Reconcile'}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={isSubmitting}
                    onPress={() => updateForm(account.accountId, { status: 'closed' })}
                  >
                    Cancel
                  </Button>
                </View>
              </>
            ) : (
              <Button variant="secondary" onPress={() => updateForm(account.accountId, { status: 'open', value: '' })}>
                Reconcile
              </Button>
            )}

            {accountFeedback ? (
              <Text accessibilityRole="alert" className="text-detail text-muted-light dark:text-muted-dark">
                {accountFeedback.status === 'adjusted'
                  ? 'Balance adjusted. The adjustment is visible in Transactions.'
                  : 'Balance already matched. Nothing changed.'}
              </Text>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
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
