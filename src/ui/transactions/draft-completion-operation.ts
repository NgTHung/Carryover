/**
 * Coordinates an uncertain draft completion without weakening the repository
 * boundary. A rejected write is followed by a read of the same id, so a
 * committed row is recognized instead of being written a second time.
 */
import type {
  CompleteDraftInput,
  CompleteTransaction,
  DraftTransaction,
  Transaction,
} from '../../data/transaction-validation';
import { parseTransaction } from '../../data/transaction-validation';
import { buildCompleteDraftPayload, type TransactionFormValues, type ValidatedTransactionForm } from './transaction-form';

export type DraftCompletionAttempt = Readonly<{
  transactionId: string;
  input: CompleteDraftInput;
  original: DraftTransaction;
  expected: CompleteTransaction;
}>;

export type DraftCompletionReconciliation =
  | { status: 'committed'; transaction: CompleteTransaction }
  | { status: 'retry'; transaction: DraftTransaction; writeError: unknown }
  | { status: 'conflict'; transaction: Transaction; writeError: unknown }
  | { status: 'unavailable'; message: string; writeError: unknown }
  | { status: 'read-failed'; readError: unknown; writeError: unknown };

export type DraftCompletionOutcome =
  | { status: 'committed'; transaction: CompleteTransaction }
  | { status: 'retry'; transaction: DraftTransaction; writeError: unknown }
  | { status: 'conflict'; transaction: Transaction; writeError: unknown }
  | { status: 'unavailable'; message: string; writeError: unknown }
  | { status: 'read-failed'; readError: unknown; writeError: unknown };

function sameDate(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}

function samePayer(left: Transaction['payer'], right: Transaction['payer']): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'you' || right.kind === 'you') return true;
  return left.contactId === right.contactId;
}

/**
 * Compares the stored fields that completion can observe. `updatedAt` is
 * database-owned and is intentionally excluded from this identity check.
 */
export function sameCompletionFields(left: Transaction, right: Transaction): boolean {
  return (
    left.id === right.id &&
    left.amount === right.amount &&
    left.direction === right.direction &&
    left.categoryId === right.categoryId &&
    left.accountId === right.accountId &&
    left.quality === right.quality &&
    sameDate(left.occurredAt, right.occurredAt) &&
    left.note === right.note &&
    left.sourceLabel === right.sourceLabel &&
    samePayer(left.payer, right.payer) &&
    left.adjustmentEffect === right.adjustmentEffect &&
    left.photoKey === right.photoKey
  );
}

export function freezeDraftCompletionAttempt(
  transaction: Transaction,
  values: TransactionFormValues,
  validation: ValidatedTransactionForm
): DraftCompletionAttempt {
  if (transaction.status !== 'draft') {
    throw new Error('Only a draft can be completed.');
  }

  const input = buildCompleteDraftPayload(transaction, values, validation);
  const expected = parseTransaction({
    ...transaction,
    ...input.changes,
    status: 'complete' as const,
    amount: input.amount,
    categoryId: input.categoryId === undefined ? transaction.categoryId : input.categoryId,
  });

  if (expected.status !== 'complete') {
    throw new Error('Completion did not produce a complete transaction.');
  }

  return Object.freeze({
    transactionId: transaction.id,
    input: Object.freeze({
      ...input,
      changes: input.changes === undefined
        ? undefined
        : Object.freeze({ ...input.changes }),
    }),
    original: Object.freeze({ ...transaction }),
    expected: Object.freeze(expected),
  });
}

export async function reconcileDraftCompletion(
  attempt: DraftCompletionAttempt,
  readTransaction: (id: string) => Promise<Transaction | undefined>,
  writeError: unknown
): Promise<DraftCompletionReconciliation> {
  let current: Transaction | undefined;
  try {
    current = await readTransaction(attempt.transactionId);
  } catch (readError: unknown) {
    return { status: 'read-failed', readError, writeError };
  }

  if (current === undefined || current.deletedAt !== null) {
    return {
      status: 'unavailable',
      message: `Transaction ${attempt.transactionId} is no longer available.`,
      writeError,
    };
  }

  if (current.status === 'complete') {
    return sameCompletionFields(current, attempt.expected)
      ? { status: 'committed', transaction: current }
      : { status: 'conflict', transaction: current, writeError };
  }

  return sameCompletionFields(current, attempt.original)
    ? { status: 'retry', transaction: current, writeError }
    : { status: 'conflict', transaction: current, writeError };
}

export async function completeDraftWithRecovery(
  attempt: DraftCompletionAttempt,
  completeDraft: (input: CompleteDraftInput) => Promise<Transaction>,
  readTransaction: (id: string) => Promise<Transaction | undefined>
): Promise<DraftCompletionOutcome> {
  try {
    const transaction = await completeDraft(attempt.input);
    if (transaction.status !== 'complete') {
      throw new Error('Completion returned a draft transaction.');
    }
    return { status: 'committed', transaction };
  } catch (writeError: unknown) {
    return reconcileDraftCompletion(attempt, readTransaction, writeError);
  }
}
