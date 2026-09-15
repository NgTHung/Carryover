/**
 * Pure state and validation rules for recording a transfer.
 *
 * Amount and date remain text until submission succeeds. This prevents an
 * invalid paste or a failed write from changing what the user typed.
 */
import { dateOnlyFromLocalDate, dateOnlySchema, localDateFromDateOnly } from '../../data/date-only';
import { assertManualOccurredAt } from '../../data/manual-transaction-policy';
import type { ActiveAccount } from '../../data/accounts';
import { positiveVndInputSchema } from '../../data/money-validation';
import {
  recordTransferSchema,
  type RecordTransfer,
} from '../../data/account-validation';

export type TransferFormValues = {
  amount: string;
  date: string;
  fromAccountId: string;
  toAccountId: string;
};

export type TransferFormErrors = {
  amount?: string;
  date?: string;
  accounts?: string;
  form?: string;
};

export type TransferFormInitialization =
  | { status: 'ready'; values: TransferFormValues }
  | { status: 'error'; message: string };

export type ValidTransferForm = {
  valid: true;
  payload: RecordTransfer;
};

export type InvalidTransferForm = {
  valid: false;
  errors: TransferFormErrors;
};

export type TransferFormValidation = ValidTransferForm | InvalidTransferForm;

function fixedAccountPair(accounts: readonly ActiveAccount[]):
  | { bank: ActiveAccount; cash: ActiveAccount }
  | undefined {
  const banks = accounts.filter(
    (account) => account.kind === 'bank' && account.isDefault
  );
  const cashAccounts = accounts.filter((account) => account.kind === 'cash');
  const bank = banks.length === 1 ? banks[0] : undefined;
  const cash = cashAccounts.length === 1 ? cashAccounts[0] : undefined;
  if (bank === undefined || cash === undefined || bank.accountId === cash.accountId) {
    return undefined;
  }
  return { bank, cash };
}

function dateText(date: Date): string {
  return dateOnlyFromLocalDate(date);
}

export function initializeTransferForm(
  accounts: readonly ActiveAccount[],
  openedAt: Date
): TransferFormInitialization {
  const pair = fixedAccountPair(accounts);
  if (pair === undefined) {
    return {
      status: 'error',
      message: 'Two active accounts, one default bank and one cash account, are required to record a transfer.',
    };
  }
  try {
    return {
      status: 'ready',
      values: {
        amount: '',
        date: dateText(openedAt),
        fromAccountId: pair.bank.accountId,
        toAccountId: pair.cash.accountId,
      },
    };
  } catch (error: unknown) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function selectFromAccount(
  values: TransferFormValues,
  accountId: string
): TransferFormValues {
  return accountId === values.toAccountId
    ? { ...values, fromAccountId: accountId, toAccountId: values.fromAccountId }
    : { ...values, fromAccountId: accountId };
}

export function selectToAccount(
  values: TransferFormValues,
  accountId: string
): TransferFormValues {
  return accountId === values.fromAccountId
    ? { ...values, fromAccountId: values.toAccountId, toAccountId: accountId }
    : { ...values, toAccountId: accountId };
}

function parseOccurredAt(
  value: string,
  anchor: Date
): { occurredAt: Date } | { error: string } {
  const parsed = dateOnlySchema.safeParse(value);
  if (!parsed.success) return { error: 'Enter a valid date as YYYY-MM-DD.' };
  try {
    return { occurredAt: localDateFromDateOnly(parsed.data, anchor) };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export function validateTransferForm(
  values: TransferFormValues,
  accounts: readonly ActiveAccount[],
  dateAnchor: Date,
  now: Date
): TransferFormValidation {
  const errors: TransferFormErrors = {};
  const amount = positiveVndInputSchema.safeParse(values.amount);
  if (!amount.success) {
    errors.amount = 'Enter a positive whole-dong amount.';
  }

  const parsedDate = parseOccurredAt(values.date, dateAnchor);
  if ('error' in parsedDate) {
    errors.date = parsedDate.error;
  } else {
    try {
      assertManualOccurredAt(parsedDate.occurredAt, now);
    } catch (error: unknown) {
      errors.date = error instanceof Error ? error.message : String(error);
    }
  }

  if (values.fromAccountId === '' || values.toAccountId === '') {
    errors.accounts = 'Select both From and To accounts.';
  } else if (values.fromAccountId === values.toAccountId) {
    errors.accounts = 'From and To must be different accounts.';
  } else {
    const activeIds = new Set(accounts.map((account) => account.accountId));
    if (!activeIds.has(values.fromAccountId) || !activeIds.has(values.toAccountId)) {
      errors.accounts = 'A selected account is unavailable. Refresh account data before saving.';
    }
  }

  if (Object.keys(errors).length > 0 || !amount.success || 'error' in parsedDate) {
    return { valid: false, errors };
  }

  const payload = recordTransferSchema.safeParse({
    fromAccountId: values.fromAccountId,
    toAccountId: values.toAccountId,
    amount: amount.data,
    occurredAt: parsedDate.occurredAt,
  });
  if (!payload.success) {
    return {
      valid: false,
      errors: { form: 'Transfer details are invalid. Check the amount, date, and accounts.' },
    };
  }
  return { valid: true, payload: payload.data };
}

export function buildTransferPayload(
  values: TransferFormValues,
  validation: ValidTransferForm
): RecordTransfer {
  return recordTransferSchema.parse({
    ...validation.payload,
    fromAccountId: values.fromAccountId,
    toAccountId: values.toAccountId,
  });
}

export function accountChoiceLabel(account: ActiveAccount): string {
  return `${account.name} (${account.kind})`;
}
