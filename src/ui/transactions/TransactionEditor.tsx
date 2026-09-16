/**
 * Edits one stored transaction without owning ledger persistence.
 *
 * Supported expense and income rows use the shared manual form. Adjustments
 * and transfers remain read-only, and failed writes keep the local form state.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { ActiveAccount } from '../../data/accounts';
import type { Category, CategoryGroupWithLeaves } from '../../data/category-types';
import type { Transaction } from '../../data/transaction-validation';
import type { PhotoAvailability } from '../../photos/photo-contract';
import { Button } from '../index';
import { HomeRouteLink } from '../HomeRouteLink';
import { InlineCategoryCreator, type InlineCategoryCreationIntent } from '../categories/InlineCategoryCreator';
import type { LeafSelectorCapability } from '../categories/leaf-selector-contract';
import { PhotoThumbnail, type PhotoThumbnailResolver } from '../photos/PhotoThumbnail';
import { TransactionFormFields } from './TransactionFormFields';
import type { TransactionEditorData } from './transaction-editor-contract';
import { useTransactionEditorChoices } from './useTransactionEditorChoices';
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

const unavailablePhoto: PhotoThumbnailResolver = async (photoKey): Promise<PhotoAvailability> => ({
  status: 'unavailable',
  photoKey,
  reason: 'unsupported-platform',
  message: 'Photo resolution is unavailable.',
});

export function TransactionEditor({
  transaction,
  groups,
  accounts,
  data,
  onDone,
  resolvePhoto = unavailablePhoto,
  accountRefreshError,
  onRetryAccountRefresh,
  categoryRefreshError,
  onRetryCategoryRefresh,
  now = () => new Date(),
}: {
  transaction: Transaction;
  groups: CategoryGroupWithLeaves[];
  accounts: ActiveAccount[];
  data: TransactionEditorData;
  onDone: () => void;
  resolvePhoto?: PhotoThumbnailResolver;
  accountRefreshError?: string;
  onRetryAccountRefresh?: () => void;
  categoryRefreshError?: string;
  onRetryCategoryRefresh?: () => void;
  now?: () => Date;
}) {
  const startingForm = useMemo(() => initializeEditorForm(transaction), [transaction]);
  const [form, setForm] = useState<TransactionFormValues | undefined>(startingForm);
  const [errors, setErrors] = useState<TransactionFormErrors>({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [categoryCreation, setCategoryCreation] = useState<InlineCategoryCreationIntent | null>(null);
  const [categoryPending, setCategoryPending] = useState(false);
  const categoryPendingRef = useRef(false);
  const [leafSelectorResetKey, setLeafSelectorResetKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const choices = useTransactionEditorChoices(groups, data.listActiveCategoryGroups);

  const onCategoryPendingChange = useCallback((pending: boolean) => {
    categoryPendingRef.current = pending;
    setCategoryPending(pending);
  }, []);

  const openGroupCreator = useCallback(() => {
    if (!busyRef.current && !categoryPendingRef.current) {
      setCategoryCreation({ kind: 'group' });
    }
  }, []);

  const openLeafCreator = useCallback((groupId?: string) => {
    if (!busyRef.current && !categoryPendingRef.current) {
      setCategoryCreation({ kind: 'leaf', groupId });
    }
  }, []);

  const leafSelectorCapability = useMemo<LeafSelectorCapability>(
    () => ({
      kind: 'creation-enabled',
      onCreateGroup: openGroupCreator,
      onCreateLeaf: openLeafCreator,
    }),
    [openGroupCreator, openLeafCreator]
  );

  const onCategoryCreated = useCallback(
    (category: Category) => {
      choices.mergeCreatedCategory(category);
      if (category.level === 'leaf') {
        setForm((current) =>
          current === undefined ? current : { ...current, categoryId: category.id }
        );
        setErrors((current) => ({ ...current, leaf: undefined }));
        setLeafSelectorResetKey((current) => current + 1);
      }
    },
    [choices.mergeCreatedCategory]
  );

  const closeCategoryCreator = useCallback(() => {
    setCategoryCreation(null);
    onCategoryPendingChange(false);
  }, [onCategoryPendingChange]);

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
    if (busyRef.current || categoryPendingRef.current) return;

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
    if (busyRef.current || categoryPendingRef.current) return;
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
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          {transaction.status === 'draft' ? 'Complete draft' : 'Edit transaction'}
        </Text>
        <Text className="text-body text-muted-light dark:text-muted-dark">
          {transaction.status === 'draft' ? 'Add the fields needed to complete this draft.' : 'Complete'}
        </Text>
      </View>

      <View className="items-center">
        <PhotoThumbnail
          photoKey={transaction.photoKey}
          resolvePhoto={resolvePhoto}
          size={180}
          testID="transaction-photo"
        />
      </View>

      {accountRefreshError ? (
        <View className="gap-2 rounded-surface border border-error-light p-3 dark:border-error-dark">
          <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
            Account choices could not refresh: {accountRefreshError}
          </Text>
          {onRetryAccountRefresh ? (
            <Button size="compact" variant="secondary" onPress={onRetryAccountRefresh}>
              Retry account refresh
            </Button>
          ) : null}
        </View>
      ) : null}
      {categoryRefreshError ? (
        <View className="gap-2 rounded-surface border border-error-light p-3 dark:border-error-dark">
          <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
            Category choices could not refresh: {categoryRefreshError}
          </Text>
          {onRetryCategoryRefresh ? (
            <Button size="compact" variant="secondary" onPress={onRetryCategoryRefresh}>
              Retry category refresh
            </Button>
          ) : null}
        </View>
      ) : null}

      {errors.form ? (
        <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
          {errors.form}
        </Text>
      ) : null}

      <TransactionFormFields
        values={form}
        groups={choices.groups}
        accounts={accounts}
        errors={errors}
        disabled={busy || categoryPending}
        leafSelectorCapability={leafSelectorCapability}
        leafSelectorResetKey={leafSelectorResetKey}
        presentation={{ kind: 'editable' }}
        onChange={(next) => setForm(next)}
      />

      {categoryCreation ? (
        <InlineCategoryCreator
          groups={choices.groups}
          intent={categoryCreation}
          createCategory={data.createCategory}
          refreshCategories={choices.refreshCategories}
          onCreated={onCategoryCreated}
          onCancel={closeCategoryCreator}
          onPendingChange={onCategoryPendingChange}
        />
      ) : null}

      <Button fullWidth disabled={busy || categoryPending} onPress={() => void submit()}>
        {actionLabel}
      </Button>

      {confirmDelete ? (
        <View className="gap-2 rounded-surface border border-error-light p-4 dark:border-error-dark">
          <Text className="text-body text-ink-light dark:text-ink-dark">
            Delete this transaction? It stays in ledger history for backup and audit.
          </Text>
          <View className="flex-row gap-2">
            <Button variant="danger" disabled={busy || categoryPending} onPress={() => void remove()}>
              Delete transaction
            </Button>
            <Button variant="secondary" disabled={busy || categoryPending} onPress={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </View>
        </View>
      ) : (
        <Button variant="danger" disabled={busy || categoryPending} onPress={() => setConfirmDelete(true)}>
          Delete
        </Button>
      )}
      <HomeRouteLink />
    </ScrollView>
  );
}
