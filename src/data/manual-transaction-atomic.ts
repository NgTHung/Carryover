/**
 * Shared atomic work for complete transactions entered by hand.
 *
 * Manual creation and reserve payment both use this module so account,
 * category, period, income, and notification behavior cannot drift.
 */
import { and, eq, isNull } from 'drizzle-orm';

import type { LedgerDatabase } from './atomic';
import { createCategoryData } from './categories';
import type { LedgerChangeNotifier } from './ledger-change-notifier';
import {
  assertManualOccurredAt,
  optionalManualText,
} from './manual-transaction-policy';
import { currentPeriod } from './period';
import {
  prepareCurrentPeriodInTransaction,
  refreshCurrentPeriodIncomeInTransaction,
  type PeriodPreparationMutation,
} from './period-preparation';
import { accounts } from './schema';
import {
  parseCreateTransactionInput,
  type CreateTransactionInput,
  type Transaction,
} from './transaction-validation';
import { createTransactionData } from './transactions';

function completeManualTransactionRequired(): Error {
  return new Error('Manual transaction creation requires a complete transaction');
}

function manualDirectionRequired(): Error {
  return new Error('Manual transactions must use expense or income direction');
}

function activeAccountWriteFailed(accountId: string): Error {
  return new Error(`Active account ${accountId} was not found`);
}

function normalizeManualCreate(input: CreateTransactionInput): CreateTransactionInput {
  if (input.status !== 'complete') throw completeManualTransactionRequired();
  if (input.direction !== 'expense' && input.direction !== 'income') {
    throw manualDirectionRequired();
  }
  return {
    ...input,
    adjustmentEffect: null,
    categoryId: input.direction === 'expense' ? input.categoryId : null,
    payer: { kind: 'you' },
    photoKey: null,
    note: optionalManualText(input.note),
    sourceLabel: input.direction === 'income' ? optionalManualText(input.sourceLabel) : null,
  };
}

export function parseCompleteManualTransactionCreate(
  input: unknown
): CreateTransactionInput {
  return normalizeManualCreate(parseCreateTransactionInput(input));
}

export function mergePeriodPreparationMutations(
  left: PeriodPreparationMutation,
  right: PeriodPreparationMutation
): PeriodPreparationMutation {
  if (left === 'created' || right === 'created') return 'created';
  if (left === 'edited' || right === 'edited') return 'edited';
  return 'none';
}

export async function requireActiveManualAccount<
  TResultKind extends 'sync' | 'async',
>(db: LedgerDatabase<TResultKind>, accountId: string): Promise<void> {
  const row = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
    .get();
  if (row === undefined) throw activeAccountWriteFailed(accountId);
}

export function notifyManualTransactionMutation(
  changeNotifier: LedgerChangeNotifier,
  periodMutation: PeriodPreparationMutation,
  mutation: 'created' | 'edited' | 'completed' | 'deleted'
): void {
  if (periodMutation !== 'none') {
    changeNotifier.notify({
      table: 'month_config',
      mutation: periodMutation === 'created' ? 'created' : 'edited',
    });
  }
  changeNotifier.notify({ table: 'transactions', mutation });
}

export type CompleteManualTransactionResult = {
  transaction: Transaction;
  periodMutation: PeriodPreparationMutation;
};

export async function createCompleteManualTransactionInTransaction<
  TResultKind extends 'sync' | 'async',
>(
  transactionDb: LedgerDatabase<TResultKind>,
  input: CreateTransactionInput,
  at: Date
): Promise<CompleteManualTransactionResult> {
  const parsed = normalizeManualCreate(input);
  const silentNotifier: LedgerChangeNotifier = {
    subscribe: () => () => undefined,
    notify: () => undefined,
  };
  const categoryData = createCategoryData(transactionDb, silentNotifier);
  const transactionData = createTransactionData(
    transactionDb,
    categoryData,
    silentNotifier
  );
  assertManualOccurredAt(parsed.occurredAt, at);
  await requireActiveManualAccount(transactionDb, parsed.accountId);
  if (parsed.direction === 'expense' && parsed.categoryId !== null) {
    await categoryData.requireActiveLeafCategory(parsed.categoryId);
  }
  const preparation = await prepareCurrentPeriodInTransaction(transactionDb, at);
  const transaction = await transactionData.createTransaction(parsed);
  const incomeMutation = await refreshCurrentPeriodIncomeInTransaction(
    transactionDb,
    currentPeriod(at),
    at
  );
  return {
    transaction,
    periodMutation: mergePeriodPreparationMutations(
      preparation.mutation,
      incomeMutation
    ),
  };
}
