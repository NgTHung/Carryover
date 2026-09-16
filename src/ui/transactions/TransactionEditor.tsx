/**
 * Edits one stored transaction without owning ledger persistence.
 *
 * Supported expense and income rows use the shared manual form. Adjustments
 * and transfers remain read-only, and failed writes keep the local form state.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  completeDraftWithRecovery,
  freezeDraftCompletionAttempt,
  reconcileDraftCompletion,
  type DraftCompletionAttempt,
} from './draft-completion-operation';
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

type SubmissionKind = 'completion' | 'edit' | 'delete';

type Submission =
  | { status: 'editing' }
  | { status: 'pending'; kind: SubmissionKind }
  | { status: 'reconciling'; attempt: DraftCompletionAttempt }
  | { status: 'failed'; kind: SubmissionKind; message: string; attempt?: DraftCompletionAttempt }
  | { status: 'reconciliation-failed'; attempt: DraftCompletionAttempt; message: string }
  | { status: 'conflict'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'committed'; kind: SubmissionKind; transaction?: Transaction }
  | {
      status: 'navigation-failed';
      kind: SubmissionKind;
      transaction?: Transaction;
      message: string;
    };

function submissionBusy(submission: Submission): boolean {
  return submission.status === 'pending' || submission.status === 'reconciling';
}

function submissionTerminal(submission: Submission): boolean {
  return (
    submission.status === 'reconciliation-failed' ||
    submission.status === 'conflict' ||
    submission.status === 'unavailable' ||
    submission.status === 'committed' ||
    submission.status === 'navigation-failed'
  );
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
  returnLabel = 'Back to transactions',
  resolvePhoto = unavailablePhoto,
  accountRefreshError,
  onRetryAccountRefresh,
  categoryRefreshError,
  onRetryCategoryRefresh,
  onWritePending,
  navigationError,
  onRetryNavigation,
  now = () => new Date(),
}: {
  transaction: Transaction;
  groups: CategoryGroupWithLeaves[];
  accounts: ActiveAccount[];
  data: TransactionEditorData;
  onDone: () => void;
  returnLabel?: string;
  resolvePhoto?: PhotoThumbnailResolver;
  accountRefreshError?: string;
  onRetryAccountRefresh?: () => void;
  categoryRefreshError?: string;
  onRetryCategoryRefresh?: () => void;
  onWritePending?: (pending: boolean) => void;
  navigationError?: string;
  onRetryNavigation?: () => void;
  now?: () => Date;
}) {
  const startingForm = useMemo(() => initializeEditorForm(transaction), [transaction]);
  const [form, setForm] = useState<TransactionFormValues | undefined>(startingForm);
  const [errors, setErrors] = useState<TransactionFormErrors>({});
  const [submission, setSubmission] = useState<Submission>({ status: 'editing' });
  const busyRef = useRef(false);
  const mountedRef = useRef(false);
  const submissionGenerationRef = useRef(0);
  const committedRef = useRef(false);
  const [categoryCreation, setCategoryCreation] = useState<InlineCategoryCreationIntent | null>(null);
  const [categoryPending, setCategoryPending] = useState(false);
  const categoryPendingRef = useRef(false);
  const [leafSelectorResetKey, setLeafSelectorResetKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const choices = useTransactionEditorChoices(groups, data.listActiveCategoryGroups);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      submissionGenerationRef.current += 1;
    };
  }, []);

  const isCurrentSubmission = useCallback((generation: number): boolean => (
    mountedRef.current && generation === submissionGenerationRef.current
  ), []);

  const onCategoryPendingChange = useCallback((pending: boolean) => {
    categoryPendingRef.current = pending;
    setCategoryPending(pending);
  }, []);

  const openGroupCreator = useCallback(() => {
    if (!busyRef.current && !committedRef.current && !categoryPendingRef.current) {
      setCategoryCreation({ kind: 'group' });
    }
  }, []);

  const openLeafCreator = useCallback((groupId?: string) => {
    if (!busyRef.current && !committedRef.current && !categoryPendingRef.current) {
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
          current === undefined || current.direction !== 'expense'
            ? current
            : { ...current, categoryId: category.id }
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

  const finishCommitted = useCallback(
    (kind: SubmissionKind, committedTransaction?: Transaction): void => {
      if (!mountedRef.current) return;
      committedRef.current = true;
      busyRef.current = false;
      onWritePending?.(false);
      setSubmission({ status: 'committed', kind, transaction: committedTransaction });
      try {
        onDone();
      } catch (error: unknown) {
        if (!mountedRef.current) return;
        setSubmission({
          status: 'navigation-failed',
          kind,
          transaction: committedTransaction,
          message: errorMessage(error),
        });
      }
    },
    [onDone, onWritePending]
  );

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
        <Button onPress={onDone}>{returnLabel}</Button>
      </View>
    );
  }

  const draftAmount = form.amount.trim() !== '';
  const canCompleteDraft = transaction.status === 'draft' &&
    draftAmount &&
    (form.direction === 'income' ||
      (form.direction === 'expense' && form.categoryId !== null));
  const busy = submissionBusy(submission);
  const terminal = submissionTerminal(submission);
  const formDisabled = busy || terminal || categoryPending;
  const actionLabel = submission.status === 'failed' && submission.kind === 'completion'
    ? 'Retry completion'
    : transaction.status === 'draft'
      ? canCompleteDraft ? 'Complete' : 'Save draft'
      : 'Save transaction';

  const submit = async () => {
    if (busyRef.current || committedRef.current || categoryPendingRef.current || terminal) return;

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

    const generation = submissionGenerationRef.current;
    const completing = transaction.status === 'draft' && canCompleteDraft;
    busyRef.current = true;
    setCategoryCreation(null);
    onWritePending?.(true);
    setErrors({});
    setSubmission({ status: 'pending', kind: completing ? 'completion' : 'edit' });
    try {
      if (completing) {
        const attempt = freezeDraftCompletionAttempt(transaction, form, validation);
        const outcome = await completeDraftWithRecovery(
          attempt,
          data.completeDraft,
          data.readTransaction
        );
        if (!isCurrentSubmission(generation)) return;
        if (outcome.status === 'committed') {
          finishCommitted('completion', outcome.transaction);
          return;
        }
        busyRef.current = false;
        onWritePending?.(false);
        if (outcome.status === 'retry') {
          setSubmission({
            status: 'failed',
            kind: 'completion',
            message: `Could not confirm completion. ${errorMessage(outcome.writeError)}`,
            attempt,
          });
        } else if (outcome.status === 'read-failed') {
          setSubmission({
            status: 'reconciliation-failed',
            attempt,
            message: `Could not verify the completion. ${errorMessage(outcome.readError)}`,
          });
        } else if (outcome.status === 'conflict') {
          setSubmission({
            status: 'conflict',
            message: 'This transaction changed while completion was in progress. Reload it before trying again.',
          });
        } else {
          setSubmission({ status: 'unavailable', message: outcome.message });
        }
        return;
      } else {
        const edited = await data.editTransaction({
          transactionId: transaction.id,
          changes: buildEditChanges(transaction, form, validation),
        });
        if (!isCurrentSubmission(generation)) return;
        finishCommitted('edit', edited);
      }
    } catch (error: unknown) {
      if (!isCurrentSubmission(generation)) return;
      setErrors({ form: errorMessage(error) });
      busyRef.current = false;
      onWritePending?.(false);
      setSubmission({
        status: 'failed',
        kind: completing ? 'completion' : 'edit',
        message: errorMessage(error),
      });
    }
  };

  const remove = async () => {
    if (busyRef.current || committedRef.current || categoryPendingRef.current || terminal) return;
    const generation = submissionGenerationRef.current;
    busyRef.current = true;
    setCategoryCreation(null);
    onWritePending?.(true);
    setErrors({});
    setSubmission({ status: 'pending', kind: 'delete' });
    try {
      await data.softDeleteTransaction(transaction.id);
      if (!isCurrentSubmission(generation)) return;
      finishCommitted('delete', transaction);
    } catch (error: unknown) {
      if (!isCurrentSubmission(generation)) return;
      setErrors({ form: errorMessage(error) });
      busyRef.current = false;
      onWritePending?.(false);
      setSubmission({ status: 'failed', kind: 'delete', message: errorMessage(error) });
    }
  };

  const retryCompletionCheck = async () => {
    if (busyRef.current || submission.status !== 'reconciliation-failed') return;
    const generation = submissionGenerationRef.current;
    busyRef.current = true;
    onWritePending?.(true);
    setSubmission({ status: 'reconciling', attempt: submission.attempt });
    const outcome = await reconcileDraftCompletion(
      submission.attempt,
      data.readTransaction,
      new Error('The completion write could not be verified.')
    );
    if (!isCurrentSubmission(generation)) return;
    busyRef.current = false;
    onWritePending?.(false);
    if (outcome.status === 'committed') finishCommitted('completion', outcome.transaction);
    else if (outcome.status === 'retry') {
      setSubmission({
        status: 'failed',
        kind: 'completion',
        message: `Could not confirm completion. ${errorMessage(outcome.writeError)}`,
        attempt: submission.attempt,
      });
    } else if (outcome.status === 'read-failed') {
      setSubmission({
        status: 'reconciliation-failed',
        attempt: submission.attempt,
        message: `Could not verify the completion. ${errorMessage(outcome.readError)}`,
      });
    } else if (outcome.status === 'conflict') {
      setSubmission({
        status: 'conflict',
        message: 'This transaction changed while completion was in progress. Reload it before trying again.',
      });
    } else {
      setSubmission({ status: 'unavailable', message: outcome.message });
    }
  };

  const retryNavigation = () => {
    if (
      submission.status !== 'committed' &&
      submission.status !== 'navigation-failed'
    ) return;
    try {
      onRetryNavigation?.();
      if (onRetryNavigation === undefined) onDone();
    } catch (error: unknown) {
      setSubmission({
        status: 'navigation-failed',
        kind: submission.kind,
        transaction: submission.transaction,
        message: errorMessage(error),
      });
    }
  };

  const saved = submission.status === 'committed' || submission.status === 'navigation-failed';

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

      {submission.status === 'pending' ? (
        <Text className="text-detail text-muted-light dark:text-muted-dark">
          Saving transaction…
        </Text>
      ) : null}
      {submission.status === 'reconciling' ? (
        <Text className="text-detail text-muted-light dark:text-muted-dark">
          Checking whether completion was saved…
        </Text>
      ) : null}
      {submission.status === 'failed' ? (
        <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
          Could not save the transaction. {submission.message} Try again.
        </Text>
      ) : null}
      {submission.status === 'reconciliation-failed' ? (
        <View className="gap-2 rounded-surface border border-error-light p-3 dark:border-error-dark">
          <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
            {submission.message}
          </Text>
          <Button size="compact" variant="secondary" onPress={() => void retryCompletionCheck()}>
            Retry completion check
          </Button>
        </View>
      ) : null}
      {submission.status === 'conflict' || submission.status === 'unavailable' ? (
        <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
          {submission.message}
        </Text>
      ) : null}

      {saved ? (
        <View testID="transaction-saved-state" className="gap-3 rounded-surface border border-need-light p-4 dark:border-need-dark">
          <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Transaction saved.</Text>
          <Text className="text-body text-muted-light dark:text-muted-dark">
            The ledger write is complete. You can return to {returnLabel === 'Back to drafts' ? 'drafts' : 'transactions'} safely.
          </Text>
          {submission.status === 'navigation-failed' ? (
            <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
              Navigation failed. {submission.message}
            </Text>
          ) : null}
          {navigationError ? (
            <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
              Navigation failed. {navigationError}
            </Text>
          ) : null}
          <Button variant="secondary" onPress={retryNavigation}>{returnLabel}</Button>
        </View>
      ) : (
        <>
          <TransactionFormFields
            values={form}
            groups={choices.groups}
            accounts={accounts}
            errors={errors}
            disabled={formDisabled}
            leafSelectorCapability={leafSelectorCapability}
            leafSelectorResetKey={leafSelectorResetKey}
            presentation={{ kind: 'editable' }}
            onChange={(next) => {
              if (next.direction !== form.direction) closeCategoryCreator();
              setForm(next);
              if (submission.status === 'failed') setSubmission({ status: 'editing' });
            }}
          />

          {categoryCreation ? (
            <InlineCategoryCreator
              groups={choices.groups}
              intent={categoryCreation}
              disabled={formDisabled}
              createCategory={data.createCategory}
              refreshCategories={choices.refreshCategories}
              onCreated={onCategoryCreated}
              onCancel={closeCategoryCreator}
              onPendingChange={onCategoryPendingChange}
            />
          ) : null}

          <Button fullWidth disabled={formDisabled} onPress={() => void submit()}>
            {actionLabel}
          </Button>

          {confirmDelete ? (
            <View className="gap-2 rounded-surface border border-error-light p-4 dark:border-error-dark">
              <Text className="text-body text-ink-light dark:text-ink-dark">
                Delete this transaction? It stays in ledger history for backup and audit.
              </Text>
              <View className="flex-row gap-2">
                <Button variant="danger" disabled={formDisabled} onPress={() => void remove()}>
                  Delete transaction
                </Button>
                <Button variant="secondary" disabled={formDisabled} onPress={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </View>
            </View>
          ) : (
            <Button variant="danger" disabled={formDisabled} onPress={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </>
      )}
      <HomeRouteLink />
    </ScrollView>
  );
}
