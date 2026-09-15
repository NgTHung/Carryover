/**
 * Pure form state and payload rules for manual transactions.
 *
 * Screens keep text local for fast capture, while this module owns conversion
 * to validated VND and local dates. The changed-field builder deliberately
 * omits hidden capture metadata and unchanged historical references.
 */
import { dateOnlyFromLocalDate, dateOnlySchema, localDateFromDateOnly } from '../../data/date-only';
import { assertManualOccurredAt, optionalManualText } from '../../data/manual-transaction-policy';
import { currentPeriod, type Period } from '../../data/period';
import type { ActiveAccount } from '../../data/accounts';
import type { CategoryGroupWithLeaves } from '../../data/category-types';
import {
  draftVndInputSchema,
  positiveVndInputSchema,
} from '../../data/money-validation';
import {
  parseCreateTransactionInput,
  type CompleteDraftInput,
  type CreateTransactionInput,
  type EditTransactionInput,
  type Transaction,
  type TransactionQuality,
} from '../../data/transaction-validation';

export type EditableTransactionDirection = 'expense' | 'income';

export type TransactionFormCreationIntent =
  | { kind: 'manual'; initialDirection: EditableTransactionDirection }
  | { kind: 'reserve-payment'; categoryId: string; period: Period };

export type TransactionFormValues = {
  amount: string;
  date: string;
  note: string;
  sourceLabel: string;
  direction: EditableTransactionDirection;
  accountId: string;
  categoryId: string | null;
  quality: TransactionQuality | null;
};

export type TransactionFormErrors = {
  amount?: string;
  date?: string;
  account?: string;
  leaf?: string;
  form?: string;
};

export type TransactionFormMode = 'create' | 'complete' | 'draft';

export type ValidatedTransactionForm = {
  valid: true;
  amount: number | null;
  occurredAt: Date;
  errors: TransactionFormErrors;
};

export type InvalidTransactionForm = {
  valid: false;
  errors: TransactionFormErrors;
};

export type TransactionFormValidation =
  | ValidatedTransactionForm
  | InvalidTransactionForm;

export type TransactionFormInitialization =
  | { status: 'ready'; values: TransactionFormValues }
  | { status: 'error'; message: string };

function dateText(date: Date): string {
  return dateOnlyFromLocalDate(date);
}

function defaultBankAccount(accounts: readonly ActiveAccount[]): ActiveAccount | undefined {
  const defaults = accounts.filter(
    (account) => account.kind === 'bank' && account.isDefault
  );
  return defaults.length === 1 ? defaults[0] : undefined;
}

export function initializeCreationForm(
  intent: TransactionFormCreationIntent,
  accounts: readonly ActiveAccount[],
  openedAt: Date
): TransactionFormInitialization {
  const account = defaultBankAccount(accounts);
  if (account === undefined) {
    return {
      status: 'error',
      message: 'Choose one active default bank account before creating a transaction.',
    };
  }
  const direction =
    intent.kind === 'manual' ? intent.initialDirection : 'expense';
  return {
    status: 'ready',
    values: {
      amount: '',
      date: dateText(openedAt),
      note: '',
      sourceLabel: '',
      direction,
      accountId: account.accountId,
      categoryId: intent.kind === 'reserve-payment' ? intent.categoryId : null,
      quality: null,
    },
  };
}

export function validateCreationTransactionForm(
  values: TransactionFormValues,
  intent: TransactionFormCreationIntent,
  dateAnchor: Date,
  now: Date
): TransactionFormValidation {
  const validation = validateTransactionForm(
    values,
    'create',
    dateAnchor,
    now
  );
  if (
    validation.valid &&
    intent.kind === 'reserve-payment' &&
    currentPeriod(validation.occurredAt) !== intent.period
  ) {
    return {
      valid: false,
      errors: {
        date: 'Payment date must belong to the selected commitment period.',
      },
    };
  }
  return validation;
}

export function initializeEditorForm(
  transaction: Transaction
): TransactionFormValues | undefined {
  if (transaction.direction === 'transfer' || transaction.direction === 'adjustment') {
    return undefined;
  }
  return {
    amount: transaction.amount === null ? '' : transaction.amount.toString(),
    date: dateText(transaction.occurredAt),
    note: transaction.note ?? '',
    sourceLabel: transaction.sourceLabel ?? '',
    direction: transaction.direction,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    quality: transaction.quality,
  };
}

export function transitionDirection(
  values: TransactionFormValues,
  direction: EditableTransactionDirection
): TransactionFormValues {
  return {
    ...values,
    direction,
    categoryId: direction === 'income' ? null : values.categoryId,
    sourceLabel: direction === 'expense' ? '' : values.sourceLabel,
  };
}

function parseOccurredAt(
  value: string,
  anchor: Date
): { occurredAt: Date; error?: undefined } | { occurredAt?: undefined; error: string } {
  const parsed = dateOnlySchema.safeParse(value);
  if (!parsed.success) {
    return { error: 'Enter a valid date as YYYY-MM-DD.' };
  }
  try {
    return { occurredAt: localDateFromDateOnly(parsed.data, anchor) };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export function validateTransactionForm(
  values: TransactionFormValues,
  mode: TransactionFormMode,
  dateAnchor: Date,
  now: Date
): TransactionFormValidation {
  const errors: TransactionFormErrors = {};
  const amount = (mode === 'draft' ? draftVndInputSchema : positiveVndInputSchema).safeParse(values.amount);
  if (!amount.success) {
    errors.amount = mode === 'draft'
      ? 'Enter a positive whole-dong amount, or leave a draft amount blank.'
      : 'Enter a positive whole-dong amount.';
  }

  const parsedDate = parseOccurredAt(values.date, dateAnchor);
  if (parsedDate.occurredAt === undefined) {
    errors.date = parsedDate.error;
  } else {
    try {
      assertManualOccurredAt(parsedDate.occurredAt, now);
    } catch (error: unknown) {
      errors.date = error instanceof Error ? error.message : String(error);
    }
  }

  if (values.accountId === '') {
    errors.account = 'Select an account.';
  }
  if (values.direction === 'expense' && values.categoryId === null && mode !== 'draft') {
    errors.leaf = 'Select a leaf category.';
  }
  if (values.direction === 'income' && values.categoryId !== null) {
    errors.leaf = 'Income cannot have a leaf category.';
  }

  if (Object.keys(errors).length > 0 || !amount.success || parsedDate.occurredAt === undefined) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    amount: amount.data,
    occurredAt: parsedDate.occurredAt,
    errors,
  };
}

function requireCompleteAmount(
  validation: ValidatedTransactionForm
): number {
  if (validation.amount === null) {
    throw new Error('A complete transaction needs an amount.');
  }
  return validation.amount;
}

export function buildCompleteCreatePayload(
  values: TransactionFormValues,
  validation: ValidatedTransactionForm
): CreateTransactionInput {
  const amount = requireCompleteAmount(validation);
  const payload = {
    status: 'complete' as const,
    amount,
    accountId: values.accountId,
    direction: values.direction,
    adjustmentEffect: null,
    categoryId: values.direction === 'expense' ? values.categoryId : null,
    quality: values.quality,
    payer: { kind: 'you' as const },
    photoKey: null,
    occurredAt: validation.occurredAt,
    note: optionalManualText(values.note),
    sourceLabel: values.direction === 'income' ? optionalManualText(values.sourceLabel) : null,
  };
  return parseCreateTransactionInput(payload);
}

function sameValue(left: unknown, right: unknown): boolean {
  return left instanceof Date && right instanceof Date
    ? left.getTime() === right.getTime()
    : left === right;
}

export function buildEditChanges(
  transaction: Transaction,
  values: TransactionFormValues,
  validation: ValidatedTransactionForm
): EditTransactionInput['changes'] {
  const changes: EditTransactionInput['changes'] = {};
  const amount = validation.amount;
  const occurredAt = validation.occurredAt;
  const note = optionalManualText(values.note);
  const sourceLabel = values.direction === 'income'
    ? optionalManualText(values.sourceLabel)
    : null;

  if (!sameValue(amount, transaction.amount)) changes.amount = amount;
  if (values.direction !== transaction.direction) changes.direction = values.direction;
  if (values.accountId !== transaction.accountId) changes.accountId = values.accountId;
  if (values.quality !== transaction.quality) changes.quality = values.quality;
  if (!sameValue(occurredAt, transaction.occurredAt)) changes.occurredAt = occurredAt;
  if (note !== transaction.note) changes.note = note;
  if (sourceLabel !== transaction.sourceLabel) changes.sourceLabel = sourceLabel;

  if (values.direction === 'income') {
    if (transaction.categoryId !== null) changes.categoryId = null;
  } else if (values.categoryId !== transaction.categoryId) {
    changes.categoryId = values.categoryId;
  }
  return changes;
}

export function buildCompleteDraftPayload(
  transaction: Transaction,
  values: TransactionFormValues,
  validation: ValidatedTransactionForm
): CompleteDraftInput {
  const amount = requireCompleteAmount(validation);
  const changes = buildEditChanges(transaction, values, validation);
  const {
    amount: _amount,
    categoryId: _categoryId,
    ...completionChanges
  } = changes;
  return {
    transactionId: transaction.id,
    amount,
    categoryId: values.direction === 'expense' ? values.categoryId : null,
    changes: completionChanges,
  };
}

export function categoryChoices(
  groups: readonly CategoryGroupWithLeaves[]
) {
  return groups.flatMap((group) => group.leaves);
}
