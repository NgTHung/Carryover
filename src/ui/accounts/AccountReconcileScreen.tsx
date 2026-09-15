/**
 * Account controls that operate on already-loaded account projections.
 *
 * The route owns reads and navigation. This view keeps only one local draft,
 * so a background refresh can update balances without replacing typed input.
 */
import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { accountNameSchema } from '../../data/account-validation';
import type { AccountBalance, ReconcileResult } from '../../data/accounts';
import { nonNegativeVndInputSchema } from '../../data/money-validation';
import { Button } from '../index';
import { AccountCard } from './AccountCard';
import type { AccountEditorData } from './account-editor-contract';
import type { AccountInteraction } from './account-form-state';

type Feedback =
  | { accountId: string; message: string }
  | undefined;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function validationMessage(kind: 'name' | 'openingBalance' | 'statedBalance'): string {
  if (kind === 'name') return 'Enter a non-blank account name.';
  return 'Enter a whole, nonnegative VND amount.';
}

function savedRefreshMessage(error: unknown): string {
  return `Saved, but account data could not refresh. ${errorMessage(error)} Try again.`;
}

function resultMessage(result: ReconcileResult): string {
  return result.status === 'adjusted'
    ? 'Balance adjusted. The adjustment is visible in Transactions.'
    : 'Balance already matched. Nothing changed.';
}

export function AccountReconcileScreen({
  accounts,
  data,
  onReload = async () => undefined,
  onRetryRead,
  onWritePending,
  refreshError,
}: {
  accounts: AccountBalance[];
  data: AccountEditorData;
  onReload?: () => Promise<void>;
  onRetryRead?: () => Promise<void>;
  onWritePending?: (pending: boolean) => void;
  refreshError?: string;
}) {
  const [interaction, setInteraction] = useState<AccountInteraction>({
    status: 'closed',
  });
  const [feedback, setFeedback] = useState<Feedback>();
  const mutationLockedRef = useRef(false);

  const beginDetails = (account: AccountBalance) => {
    if (mutationLockedRef.current || interaction.status !== 'closed') return;
    setFeedback(undefined);
    setInteraction({
      status: 'editing-details',
      accountId: account.accountId,
      name: account.name,
      openingBalance: account.openingBalance.toString(),
    });
  };

  const beginReconcile = (account: AccountBalance) => {
    if (mutationLockedRef.current || interaction.status !== 'closed') return;
    setFeedback(undefined);
    setInteraction({
      status: 'reconciling',
      accountId: account.accountId,
      statedBalance: '',
    });
  };

  const cancel = () => {
    if (mutationLockedRef.current) return;
    setInteraction({ status: 'closed' });
  };

  const saveDetails = async () => {
    if (interaction.status !== 'editing-details' || mutationLockedRef.current) return;
    const draft = interaction;
    const name = accountNameSchema.safeParse(draft.name);
    if (!name.success) {
      setInteraction({ ...draft, error: validationMessage('name') });
      return;
    }
    const openingBalance = nonNegativeVndInputSchema.safeParse(draft.openingBalance);
    if (!openingBalance.success) {
      setInteraction({ ...draft, error: validationMessage('openingBalance') });
      return;
    }

    mutationLockedRef.current = true;
    onWritePending?.(true);
    setFeedback(undefined);
    setInteraction({
      status: 'saving-details',
      accountId: draft.accountId,
      name: draft.name,
      openingBalance: draft.openingBalance,
    });
    try {
      await data.editAccountDetails({
        accountId: draft.accountId,
        name: name.data,
        openingBalance: openingBalance.data,
      });
      setInteraction({ status: 'closed' });
      try {
        await onReload();
        setFeedback({ accountId: draft.accountId, message: 'Account details saved.' });
      } catch (error: unknown) {
        setFeedback({ accountId: draft.accountId, message: savedRefreshMessage(error) });
      }
    } catch (error: unknown) {
      setInteraction({
        status: 'editing-details',
        accountId: draft.accountId,
        name: draft.name,
        openingBalance: draft.openingBalance,
        error: `Could not save account details. ${errorMessage(error)} Try again.`,
      });
    } finally {
      mutationLockedRef.current = false;
      onWritePending?.(false);
    }
  };

  const saveReconcile = async () => {
    if (interaction.status !== 'reconciling' || mutationLockedRef.current) return;
    const draft = interaction;
    const statedBalance = nonNegativeVndInputSchema.safeParse(draft.statedBalance);
    if (!statedBalance.success) {
      setInteraction({ ...draft, error: validationMessage('statedBalance') });
      return;
    }

    mutationLockedRef.current = true;
    onWritePending?.(true);
    setFeedback(undefined);
    setInteraction({
      status: 'saving-reconcile',
      accountId: draft.accountId,
      statedBalance: draft.statedBalance,
    });
    try {
      const result = await data.reconcileAccount({
        accountId: draft.accountId,
        statedBalance: statedBalance.data,
        occurredAt: new Date(),
      });
      setInteraction({ status: 'closed' });
      try {
        await onReload();
        setFeedback({ accountId: draft.accountId, message: resultMessage(result) });
      } catch (error: unknown) {
        setFeedback({ accountId: draft.accountId, message: savedRefreshMessage(error) });
      }
    } catch (error: unknown) {
      setInteraction({
        status: 'reconciling',
        accountId: draft.accountId,
        statedBalance: draft.statedBalance,
        error: `Could not reconcile this account. ${errorMessage(error)} Try again.`,
      });
    } finally {
      mutationLockedRef.current = false;
      onWritePending?.(false);
    }
  };

  const retryRead = async () => {
    if (onRetryRead === undefined) return;
    try {
      await onRetryRead();
      setFeedback(undefined);
    } catch {
      // The route keeps the read error visible and retryable.
    }
  };

  return (
    <ScrollView
      testID="accounts-screen"
      automaticallyAdjustKeyboardInsets
      contentContainerClassName="gap-5 bg-ground-light px-5 pb-16 pt-16 dark:bg-ground-dark"
      keyboardDismissMode="interactive"
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

      {refreshError ? (
        <View className="gap-2">
          <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
            Account data could not refresh. {refreshError}
          </Text>
          {onRetryRead ? (
            <Button variant="secondary" onPress={() => void retryRead()}>
              Try again
            </Button>
          ) : null}
        </View>
      ) : null}

      {accounts.map((account) => (
        <AccountCard
          key={account.accountId}
          account={account}
          interaction={interaction}
          feedback={feedback?.accountId === account.accountId ? feedback.message : undefined}
          formDisabled={interaction.status !== 'closed'}
          onEditDetails={() => beginDetails(account)}
          onReconcile={() => beginReconcile(account)}
          onNameChange={(name) => {
            setInteraction((current) =>
              current.status === 'editing-details' && current.accountId === account.accountId
                ? { ...current, name, error: undefined }
                : current
            );
          }}
          onOpeningBalanceChange={(openingBalance) => {
            setInteraction((current) =>
              current.status === 'editing-details' && current.accountId === account.accountId
                ? { ...current, openingBalance, error: undefined }
                : current
            );
          }}
          onSaveDetails={() => void saveDetails()}
          onCancelDetails={cancel}
          onStatedBalanceChange={(statedBalance) => {
            setInteraction((current) =>
              current.status === 'reconciling' && current.accountId === account.accountId
                ? { ...current, statedBalance, error: undefined }
                : current
            );
          }}
          onSaveReconcile={() => void saveReconcile()}
          onCancelReconcile={cancel}
        />
      ))}
    </ScrollView>
  );
}
