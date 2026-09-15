/** Commitment management UI with one locked mutation at a time. */
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { CommitmentOverview, CommitmentOverviewItem } from '../../data/commitment-overview';
import { currentPeriod, type Period } from '../../data/period';
import { Button } from '../Button';
import { CommitmentCard } from './CommitmentCard';
import { CommitmentForm } from './CommitmentForm';
import type { CommitmentManagerData } from './commitment-manager-contract';
import {
  buildCommitmentCreateInput,
  buildCommitmentEditInput,
  commitmentActivationError,
  initializeCommitmentCreateForm,
  initializeCommitmentEditForm,
  presentStoredCommitmentLeaf,
  validateCommitmentForm,
  type CommitmentFormErrors,
  type CommitmentFormValues,
  type ReserveLeafChoice,
} from './commitment-form';
import { UnpaidReserveList } from './UnpaidReserveList';

export type CommitmentManagerLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      overview: CommitmentOverview;
      choices: ReserveLeafChoice[];
    };

type FormState =
  | { status: 'closed' }
  | { status: 'create'; values: CommitmentFormValues; errors: CommitmentFormErrors }
  | {
      status: 'edit';
      item: CommitmentOverviewItem;
      values: CommitmentFormValues;
      errors: CommitmentFormErrors;
    };

type ConfirmationState =
  | { status: 'closed' }
  | { status: 'delete'; commitmentId: string }
  | { status: 'deactivate'; commitmentId: string };

type MutationOwner = 'form' | 'confirmation' | 'standalone';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function CommitmentManagerView({
  state,
  data,
  onReload,
  onChangePeriod,
  onOpenCategories,
  onRecordPayment,
  now = () => new Date(),
}: {
  state: CommitmentManagerLoadState;
  data: CommitmentManagerData;
  onReload: () => Promise<void>;
  onChangePeriod: (period: Period) => void;
  onOpenCategories: () => void;
  onRecordPayment: (commitmentId: string, period: Period) => void;
  now?: () => Date;
}) {
  const [form, setForm] = useState<FormState>({ status: 'closed' });
  const [confirmation, setConfirmation] = useState<ConfirmationState>({ status: 'closed' });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const mutationLockedRef = useRef(false);

  const setFormFailure = (message: string) => {
    setForm((current) =>
      current.status === 'closed'
        ? current
        : { ...current, errors: { ...current.errors, form: message } }
    );
  };

  const runMutation = async (
    action: () => Promise<unknown>,
    success: string,
    owner: MutationOwner
  ) => {
    if (mutationLockedRef.current) return;
    mutationLockedRef.current = true;
    setBusy(true);
    setFeedback(undefined);
    try {
      await action();
    } catch (error: unknown) {
      if (owner === 'form') setFormFailure(errorMessage(error));
      setFeedback(errorMessage(error));
      mutationLockedRef.current = false;
      setBusy(false);
      return;
    }

    if (owner === 'form') setForm({ status: 'closed' });
    if (owner === 'confirmation') setConfirmation({ status: 'closed' });
    setFeedback(success);
    try {
      await onReload();
    } catch (error: unknown) {
      setFeedback(`${success}. Refresh failed: ${errorMessage(error)}`);
    } finally {
      mutationLockedRef.current = false;
      setBusy(false);
    }
  };

  if (state.status === 'loading') {
    return <Message title="Commitments" detail="Loading commitments." />;
  }
  if (state.status === 'error') {
    return (
      <Message
        title="Commitments unavailable"
        detail={state.message}
        action={(
          <Button onPress={() => void onReload().catch(() => undefined)}>
            Try again
          </Button>
        )}
      />
    );
  }

  const { choices, overview } = state;
  const submitForm = () => {
    if (form.status === 'closed') return;
    const mode = form.status === 'create'
      ? { status: 'create' as const }
      : { status: 'edit' as const, commitment: form.item.commitment };
    const validation = validateCommitmentForm(form.values, choices, mode);
    if (!validation.valid) {
      setForm({ ...form, errors: validation.errors });
      return;
    }
    if (form.status === 'create') {
      void runMutation(
        () => data.createCommitment(buildCommitmentCreateInput(validation)),
        'Commitment created',
        'form'
      );
      return;
    }
    void runMutation(
      () => data.editCommitment(buildCommitmentEditInput(form.item.commitment, validation)),
      'Commitment updated',
      'form'
    );
  };

  const toggleActive = (item: CommitmentOverviewItem) => {
    if (item.commitment.active) {
      setConfirmation({ status: 'deactivate', commitmentId: item.commitment.id });
      return;
    }
    const error = commitmentActivationError(item.commitment, choices);
    if (error !== undefined) {
      setFeedback(error);
      return;
    }
    void runMutation(
      () => data.editCommitment({
        commitmentId: item.commitment.id,
        changes: { active: true },
      }),
      'Commitment reactivated',
      'standalone'
    );
  };

  const futurePeriod = overview.period > currentPeriod(now());
  return (
    <ScrollView
      testID="commitment-list"
      automaticallyAdjustKeyboardInsets
      contentContainerClassName="gap-5 bg-ground-light px-5 pb-16 pt-16 dark:bg-ground-dark"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-1">
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">SETTINGS</Text>
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">Commitments</Text>
        <Text className="text-body text-muted-light dark:text-muted-dark">
          Reserve known commitments and record the expense when money moves.
        </Text>
      </View>

      {feedback ? (
        <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">{feedback}</Text>
      ) : null}

      <UnpaidReserveList
        overview={overview}
        disabled={busy}
        futurePeriod={futurePeriod}
        onChangePeriod={(period) => {
          if (!mutationLockedRef.current) onChangePeriod(period);
        }}
        onRecordPayment={(commitmentId) => onRecordPayment(commitmentId, overview.period)}
      />

      <View className="gap-3">
        <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Manage commitments</Text>
        {choices.length === 0 ? (
          <View className="gap-2">
            <Text className="text-body text-muted-light dark:text-muted-dark">
              Create an active reserve leaf in Categories before adding or reactivating a commitment.
            </Text>
            <Button variant="secondary" disabled={busy} onPress={onOpenCategories}>Open Categories</Button>
          </View>
        ) : null}
        {form.status === 'create' ? (
          <CommitmentForm
            values={form.values}
            choices={choices}
            errors={form.errors}
            disabled={busy}
            submitLabel="Save commitment"
            onChange={(values) => setForm({ ...form, values, errors: {} })}
            onSubmit={submitForm}
            onCancel={() => setForm({ status: 'closed' })}
          />
        ) : (
          <Button
            fullWidth
            disabled={busy || choices.length === 0}
            onPress={() => setForm({
              status: 'create', values: initializeCommitmentCreateForm(), errors: {},
            })}
          >
            Add commitment
          </Button>
        )}

        {overview.items.length === 0 ? (
          <Text className="text-body text-muted-light dark:text-muted-dark">No commitments yet.</Text>
        ) : null}
        {overview.items.map((item) => {
          if (form.status === 'edit' && form.item.commitment.id === item.commitment.id) {
            const storedLeaf = presentStoredCommitmentLeaf(item.leaf, choices);
            return (
              <CommitmentForm
                key={item.commitment.id}
                values={form.values}
                choices={choices}
                errors={form.errors}
                disabled={busy}
                submitLabel="Save changes"
                unavailableLeafLabel={storedLeaf.selectable ? undefined : storedLeaf.label}
                onChange={(values) => setForm({ ...form, values, errors: {} })}
                onSubmit={submitForm}
                onCancel={() => setForm({ status: 'closed' })}
              />
            );
          }
          return (
            <CommitmentCard
              key={item.commitment.id}
              item={item}
              disabled={busy}
              confirmingDelete={confirmation.status === 'delete' && confirmation.commitmentId === item.commitment.id}
              confirmingDeactivate={confirmation.status === 'deactivate' && confirmation.commitmentId === item.commitment.id}
              onEdit={() => setForm({
                status: 'edit', item, values: initializeCommitmentEditForm(item.commitment), errors: {},
              })}
              onToggleActive={() => toggleActive(item)}
              onBeginDelete={() => setConfirmation({ status: 'delete', commitmentId: item.commitment.id })}
              onConfirmDelete={() => void runMutation(
                () => data.softDeleteCommitment(item.commitment.id),
                'Commitment deleted',
                'confirmation'
              )}
              onCancelDelete={() => setConfirmation({ status: 'closed' })}
              onConfirmDeactivate={() => void runMutation(
                () => data.editCommitment({
                  commitmentId: item.commitment.id, changes: { active: false },
                }),
                'Commitment deactivated',
                'confirmation'
              )}
              onCancelDeactivate={() => setConfirmation({ status: 'closed' })}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

function Message({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <View className="flex-1 gap-3 bg-ground-light px-5 py-16 dark:bg-ground-dark">
      <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">{title}</Text>
      <Text className="text-body text-muted-light dark:text-muted-dark">{detail}</Text>
      {action}
    </View>
  );
}
