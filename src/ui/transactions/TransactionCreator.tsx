/**
 * Captures one complete expense or income transaction before handing it to
 * the native manual-write boundary.
 *
 * The form stays mounted after a failed write and after a committed write.
 * This lets callers retry navigation without ever repeating the insertion.
 */
import { useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { ActiveAccount } from '../../data/accounts';
import type { CategoryGroupWithLeaves } from '../../data/category-types';
import type { Transaction } from '../../data/transaction-validation';
import { formatVnd } from '../../money/currency';
import { Button } from '../index';
import { TransactionFormFields } from './TransactionFormFields';
import type { TransactionCreateData } from './transaction-create-contract';
import {
  buildCompleteCreatePayload,
  initializeCreationForm,
  validateCreationTransactionForm,
  type TransactionFormCreationIntent,
  type TransactionFormErrors,
  type TransactionFormValues,
} from './transaction-form';
import type {
  ReservePaymentPresentation,
  TransactionCreationIntent,
} from './load-transaction-route';

export type TransactionCreatorIntent =
  | Extract<TransactionCreationIntent, { kind: 'manual' }>
  | ReservePaymentPresentation;

type CreatorMutationState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'failed'; message: string }
  | { status: 'saved'; transaction: Transaction };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function TransactionCreator({
  intent,
  accounts,
  groups,
  openedAt,
  data,
  onCancel,
  onCommitted,
  onWritePending,
  navigationError,
  onRetryNavigation,
  navigationActionLabel = 'Back to transactions',
  now = () => new Date(),
}: {
  intent: TransactionCreatorIntent;
  accounts: ActiveAccount[];
  groups: CategoryGroupWithLeaves[];
  openedAt: Date;
  data: TransactionCreateData;
  onCancel: () => void;
  onCommitted: (transaction: Transaction) => void;
  onWritePending: (pending: boolean) => void;
  navigationError?: string;
  onRetryNavigation?: () => void;
  navigationActionLabel?: string;
  now?: () => Date;
}) {
  const formIntent = useMemo<TransactionFormCreationIntent>(
    () =>
      intent.kind === 'manual'
        ? intent
        : {
            kind: 'reserve-payment',
            categoryId: intent.categoryId,
            period: intent.period,
          },
    [intent]
  );
  const initialization = useMemo(
    () => initializeCreationForm(formIntent, accounts, openedAt),
    [accounts, formIntent, openedAt]
  );
  const [form, setForm] = useState<TransactionFormValues | undefined>(
    initialization.status === 'ready' ? initialization.values : undefined
  );
  const [errors, setErrors] = useState<TransactionFormErrors>({});
  const [mutation, setMutation] = useState<CreatorMutationState>({ status: 'idle' });
  const submissionLockedRef = useRef(false);
  const committedRef = useRef(false);

  const beginWrite = () => {
    submissionLockedRef.current = true;
    onWritePending(true);
  };

  const allowRetry = () => {
    submissionLockedRef.current = false;
    onWritePending(false);
  };

  if (initialization.status === 'error' || form === undefined) {
    return (
      <View className="flex-1 gap-3 bg-ground-light px-5 py-16 dark:bg-ground-dark">
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          Cannot create transaction
        </Text>
        <Text accessibilityRole="alert" className="text-body text-error-light dark:text-error-dark">
          {initialization.status === 'error' ? initialization.message : 'The form could not initialize.'}
        </Text>
        <Button variant="secondary" onPress={onCancel}>Cancel</Button>
      </View>
    );
  }

  const saving = mutation.status === 'saving';
  const saved = mutation.status === 'saved';

  const submit = async () => {
    if (saving || saved || submissionLockedRef.current) return;

    const validation = validateCreationTransactionForm(
      form,
      formIntent,
      openedAt,
      now()
    );
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    beginWrite();
    setMutation({ status: 'saving' });
    setErrors({});

    let transaction: Transaction;
    try {
      const payload = buildCompleteCreatePayload(form, validation);
      transaction =
        intent.kind === 'manual'
          ? await data.createCompleteTransaction(payload)
          : await data.createReservePayment({
              commitmentId: intent.commitmentId,
              period: intent.period,
              transaction: payload,
            });
    } catch (error: unknown) {
      setMutation({ status: 'failed', message: errorMessage(error) });
      allowRetry();
      return;
    }

    setMutation({ status: 'saved', transaction });
    setErrors({});
    // Release route removal after commit, but keep submission locked until unmount.
    onWritePending(false);
    if (!committedRef.current) {
      committedRef.current = true;
      onCommitted(transaction);
    }
  };

  const cancel = () => {
    if (submissionLockedRef.current || saved) return;
    onCancel();
  };

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentContainerClassName="gap-5 bg-ground-light px-5 pb-16 pt-16 dark:bg-ground-dark"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-1">
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          {intent.kind === 'manual' ? `Add ${form.direction}` : 'Record payment'}
        </Text>
        <Text className="text-body text-muted-light dark:text-muted-dark">
          {intent.kind === 'manual'
            ? 'Complete transaction'
            : `${intent.commitmentName}, ${formatVnd(intent.reservedAmount)} reserved for ${intent.period}`}
        </Text>
      </View>

      {mutation.status === 'failed' ? (
        <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
          {mutation.message}
        </Text>
      ) : null}
      {navigationError ? (
        <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
          {navigationError}
        </Text>
      ) : null}
      {saved ? (
        <View className="gap-3 rounded-surface border border-need-light p-4 dark:border-need-dark">
          <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">
            Transaction saved.
          </Text>
          {onRetryNavigation ? (
            <Button variant="secondary" onPress={onRetryNavigation}>
              {navigationActionLabel}
            </Button>
          ) : null}
        </View>
      ) : (
        <TransactionFormFields
          values={form}
          groups={groups}
          accounts={accounts}
          errors={errors}
          disabled={saving}
          presentation={
            intent.kind === 'reserve-payment'
              ? { kind: 'fixed-expense', leafName: intent.leafName }
              : { kind: 'editable' }
          }
          onChange={(next) => {
            setForm(next);
            setErrors({});
          }}
        />
      )}

      {!saved ? (
        <>
          <Button fullWidth disabled={saving} onPress={() => void submit()}>
            Save transaction
          </Button>
          <Button variant="secondary" fullWidth disabled={saving} onPress={cancel}>
            Cancel
          </Button>
        </>
      ) : null}
    </ScrollView>
  );
}
