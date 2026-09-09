/**
 * Edits one stored transaction without owning ledger persistence.
 *
 * Form text stays local. Money crosses the data boundary only after the shared
 * whole-dong schema accepts it, and hidden capture or split metadata is never rewritten.
 */
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { ActiveAccount } from '../../data/accounts';
import type { CategoryGroupWithLeaves } from '../../data/category-types';
import { draftVndInputSchema } from '../../data/money-validation';
import type {
  EditTransactionInput,
  Transaction,
  TransactionQuality,
} from '../../data/transaction-validation';
import { Button, Input, QualityChip } from '../index';
import { HomeRouteLink } from '../HomeRouteLink';
import type { TransactionEditorData } from './transaction-editor-contract';

type EditableDirection = 'expense' | 'income' | 'adjustment';

type EditorForm = {
  amount: string;
  direction: EditableDirection;
  categoryId: string | null;
  accountId: string;
  quality: TransactionQuality | null;
  date: string;
  note: string;
  sourceLabel: string;
};

function dateText(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string, previous: Date): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const next = new Date(previous);
  next.setFullYear(year, month, day);
  return next.getFullYear() === year && next.getMonth() === month && next.getDate() === day
    ? next
    : undefined;
}

function initialForm(transaction: Transaction): EditorForm | undefined {
  if (transaction.direction === 'transfer') return undefined;
  return {
    amount: transaction.amount === null ? '' : transaction.amount.toString(),
    direction: transaction.direction,
    categoryId: transaction.categoryId,
    accountId: transaction.accountId,
    quality: transaction.quality,
    date: dateText(transaction.occurredAt),
    note: transaction.note ?? '',
    sourceLabel: transaction.sourceLabel ?? '',
  };
}

function Choice({ label, selected, disabled, onPress }: {
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

function changedFields(
  transaction: Transaction,
  form: EditorForm,
  amount: number | null,
  occurredAt: Date
): EditTransactionInput['changes'] {
  const candidate = {
    amount,
    direction: form.direction,
    categoryId: form.direction === 'expense' ? form.categoryId : null,
    accountId: form.accountId,
    quality: form.quality,
    occurredAt,
    note: form.note.trim() || null,
    sourceLabel: form.direction === 'income' ? form.sourceLabel.trim() || null : null,
  };
  const changes: EditTransactionInput['changes'] = {};
  for (const key of Object.keys(candidate) as Array<keyof typeof candidate>) {
    const next = candidate[key];
    const previous = transaction[key];
    const same = next instanceof Date && previous instanceof Date
      ? next.getTime() === previous.getTime()
      : next === previous;
    if (!same) Object.assign(changes, { [key]: next });
  }
  return changes;
}

export function TransactionEditor({
  transaction,
  groups,
  accounts,
  data,
  onDone,
}: {
  transaction: Transaction;
  groups: CategoryGroupWithLeaves[];
  accounts: ActiveAccount[];
  data: TransactionEditorData;
  onDone: () => void;
}) {
  const startingForm = useMemo(() => initialForm(transaction), [transaction]);
  const [form, setForm] = useState<EditorForm | undefined>(startingForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!form) {
    return (
      <View className="flex-1 gap-3 bg-ground-light px-5 py-16 dark:bg-ground-dark">
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">Transfer</Text>
        <Text className="text-body text-muted-light dark:text-muted-dark">Transfers are read-only in this screen.</Text>
        <Button onPress={onDone}>Back to transactions</Button>
      </View>
    );
  }

  const amountResult = draftVndInputSchema.safeParse(form.amount);
  const amount = amountResult.success ? amountResult.data : undefined;
  const occurredAt = parseLocalDate(form.date, transaction.occurredAt);
  const canComplete = amount !== null && amount !== undefined &&
    (form.direction !== 'expense' || form.categoryId !== null);
  const actionLabel = transaction.status === 'draft'
    ? canComplete ? 'Complete' : 'Save draft'
    : 'Save transaction';

  const submit = async () => {
    if (!amountResult.success) {
      setError('Enter a positive whole-dong amount, or leave a draft amount blank.');
      return;
    }
    if (transaction.status === 'complete' && amountResult.data === null) {
      setError('A complete transaction needs an amount.');
      return;
    }
    if (transaction.status === 'complete' && form.direction === 'expense' && form.categoryId === null) {
      setError('A complete expense needs a leaf category.');
      return;
    }
    if (!occurredAt) {
      setError('Enter a valid date as YYYY-MM-DD.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const changes = changedFields(transaction, form, amountResult.data, occurredAt);
      if (transaction.status === 'draft' && canComplete && amountResult.data !== null) {
        const { amount: _amount, categoryId: _categoryId, ...completionChanges } = changes;
        await data.completeDraft({
          transactionId: transaction.id,
          amount: amountResult.data,
          categoryId: form.direction === 'expense' ? form.categoryId : null,
          changes: completionChanges,
        });
      } else {
        await data.editTransaction({ transactionId: transaction.id, changes });
      }
      onDone();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await data.softDeleteTransaction(transaction.id);
      onDone();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
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
        <Text className="text-body text-muted-light dark:text-muted-dark">{transaction.status === 'draft' ? 'Draft' : 'Complete'}</Text>
      </View>

      {error ? <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">{error}</Text> : null}

      <Input label="Amount" keyboardType="number-pad" value={form.amount} editable={!busy} onChangeText={(amountText) => setForm({ ...form, amount: amountText })} />

      <View className="gap-2">
        <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Direction</Text>
        <View className="flex-row flex-wrap gap-2">
          {(['expense', 'income', 'adjustment'] as const).map((direction) => (
            <Choice key={direction} label={direction} selected={form.direction === direction} disabled={busy} onPress={() => setForm({ ...form, direction, categoryId: direction === 'expense' ? form.categoryId : null, sourceLabel: direction === 'income' ? form.sourceLabel : '' })} />
          ))}
        </View>
        {form.direction === 'adjustment' ? <Text className="text-detail text-muted-light dark:text-muted-dark">Adjustments do not count as spending or income.</Text> : null}
      </View>

      {form.direction === 'expense' ? (
        <View className="gap-2">
          <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Leaf</Text>
          <View className="flex-row flex-wrap gap-2">
            {groups.flatMap((group) => group.leaves).map((leaf) => (
              <Choice key={leaf.id} label={leaf.name} selected={form.categoryId === leaf.id} disabled={busy} onPress={() => setForm({ ...form, categoryId: leaf.id })} />
            ))}
          </View>
        </View>
      ) : null}

      {form.direction === 'income' ? <Input label="Source" value={form.sourceLabel} editable={!busy} onChangeText={(sourceLabel) => setForm({ ...form, sourceLabel })} /> : null}

      <View className="gap-2">
        <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Account</Text>
        <View className="flex-row flex-wrap gap-2">
          {accounts.map((account) => <Choice key={account.accountId} label={account.name} selected={form.accountId === account.accountId} disabled={busy} onPress={() => setForm({ ...form, accountId: account.accountId })} />)}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Quality</Text>
        <View className="flex-row flex-wrap gap-2">
          {(['need', 'want', 'regret'] as const).map((quality) => <QualityChip key={quality} quality={quality} selected={form.quality === quality} disabled={busy} onPress={() => setForm({ ...form, quality: form.quality === quality ? null : quality })} />)}
        </View>
      </View>

      <Input label="Date" value={form.date} editable={!busy} autoCapitalize="none" onChangeText={(date) => setForm({ ...form, date })} />
      <Input label="Note" value={form.note} editable={!busy} multiline onChangeText={(note) => setForm({ ...form, note })} />
      <Button fullWidth disabled={busy} onPress={() => void submit()}>{actionLabel}</Button>

      {confirmDelete ? (
        <View className="gap-2 rounded-surface border border-error-light p-4 dark:border-error-dark">
          <Text className="text-body text-ink-light dark:text-ink-dark">Delete this transaction? It stays in ledger history for backup and audit.</Text>
          <View className="flex-row gap-2">
            <Button variant="danger" disabled={busy} onPress={() => void remove()}>Delete transaction</Button>
            <Button variant="secondary" disabled={busy} onPress={() => setConfirmDelete(false)}>Cancel</Button>
          </View>
        </View>
      ) : <Button variant="danger" disabled={busy} onPress={() => setConfirmDelete(true)}>Delete</Button>}
      <HomeRouteLink />
    </ScrollView>
  );
}
