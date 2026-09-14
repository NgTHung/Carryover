/**
 * Edits one stored transaction without owning ledger persistence.
 *
 * Supported expense and income rows use the shared manual form. Adjustments
 * and transfers remain read-only, and failed writes keep the local form state.
 */
import { useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { ActiveAccount } from '../../data/accounts';
import type { CategoryGroupWithLeaves } from '../../data/category-types';
import type { Transaction } from '../../data/transaction-validation';
import { Button } from '../index';
import { HomeRouteLink } from '../HomeRouteLink';
import { TransactionFormFields } from './TransactionFormFields';
import type { TransactionEditorData } from './transaction-editor-contract';
import {
  buildCompleteDraftPayload,
  buildEditChanges,
  initializeEditorForm,
  validateTransactionForm,
  type TransactionFormErrors,
  type TransactionFormValues,
} from './transaction-form';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function TransactionEditor({
  transaction,
  groups,
  accounts,
  data,
  onDone,
  now = () => new Date(),
}: {
  transaction: Transaction;
  groups: CategoryGroupWithLeaves[];
  accounts: ActiveAccount[];
  data: TransactionEditorData;
  onDone: () => void;
  now?: () => Date;
}) {
  const startingForm = useMemo(() => initializeEditorForm(transaction), [transaction]);
  const [form, setForm] = useState<TransactionFormValues | undefined>(startingForm);
  const [errors, setErrors] = useState<TransactionFormErrors>({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (form === undefined) {
    return (
      <View className="flex-1 gap-3 bg-ground-light px-5 py-16 dark:bg-ground-dark">
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          {transaction.direction === 'adjustment' ? 'Adjustment' : 'Transfer'}
        </Text>
        <Text className="text-body text-muted-light dark:text-muted-dark">
          {transaction.direction === 'adjustment'
            ? 'Adjustments are read-only. Reconcile the account to create another one.'
            : 'Transfers are read-only in this screen.'}
        </Text>
        <Button onPress={onDone}>Back to transactions</Button>
      </View>
    );
  }

  const draftAmount = form.amount.trim() !== '';
  const canCompleteDraft = transaction.status === 'draft' &&
    draftAmount &&
    (form.direction === 'income' ||
      (form.direction === 'expense' && form.categoryId !== null));
  const actionLabel = transaction.status === 'draft'
    ? canCompleteDraft ? 'Complete' : 'Save draft'
    : 'Save transaction';

  const submit = async () => {
    if (busyRef.current) return;

    const mode = transaction.status === 'complete' || canCompleteDraft
      ? 'complete'
      : 'draft';
    const validation = validateTransactionForm(
      form,
      mode,
      transaction.occurredAt,
      now()
    );
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setErrors({});
    try {
      if (transaction.status === 'draft' && canCompleteDraft) {
        await data.completeDraft(
          buildCompleteDraftPayload(transaction, form, validation)
        );
      } else {
        await data.editTransaction({
          transactionId: transaction.id,
          changes: buildEditChanges(transaction, form, validation),
        });
      }
      onDone();
    } catch (error: unknown) {
      setErrors({ form: errorMessage(error) });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErrors({});
    try {
      await data.softDeleteTransaction(transaction.id);
      onDone();
    } catch (error: unknown) {
      setErrors({ form: errorMessage(error) });
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentContainerClassName="gap-5 bg-ground-light px-5 pb-16 pt-16 dark:bg-ground-dark"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-1">
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">Edit transaction</Text>
        <Text className="text-body text-muted-light dark:text-muted-dark">
          {transaction.status === 'draft' ? 'Draft' : 'Complete'}
        </Text>
      </View>

      {errors.form ? (
        <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
          {errors.form}
        </Text>
      ) : null}

      <TransactionFormFields
        values={form}
        groups={groups}
        accounts={accounts}
        errors={errors}
        disabled={busy}
        onChange={(next) => setForm(next)}
      />

      <Button fullWidth disabled={busy} onPress={() => void submit()}>
        {actionLabel}
      </Button>

      {confirmDelete ? (
        <View className="gap-2 rounded-surface border border-error-light p-4 dark:border-error-dark">
          <Text className="text-body text-ink-light dark:text-ink-dark">
            Delete this transaction? It stays in ledger history for backup and audit.
          </Text>
          <View className="flex-row gap-2">
            <Button variant="danger" disabled={busy} onPress={() => void remove()}>
              Delete transaction
            </Button>
            <Button variant="secondary" disabled={busy} onPress={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </View>
        </View>
      ) : (
        <Button variant="danger" disabled={busy} onPress={() => setConfirmDelete(true)}>
          Delete
        </Button>
      )}
      <HomeRouteLink />
    </ScrollView>
  );
}
