/**
 * Atomic boundary for transactions entered or edited by hand.
 *
 * The generic transaction repository remains useful for capture and restore.
 * This adapter adds the manual date and reference policy, then runs period
 * preparation, the ledger mutation, and current-income maintenance inside one
 * caller-supplied SQLite transaction.
 */
import { and, eq } from 'drizzle-orm';

import {
  createDefaultAtomicRunner,
  type AtomicTransactionRunner,
  type LedgerDatabase,
} from './atomic';
import { createCategoryData, type CategoryData } from './categories';
import { assertManualOccurredAt, optionalManualText } from './manual-transaction-policy';
import { currentPeriod } from './period';
import {
  prepareCurrentPeriodInTransaction,
  refreshCurrentPeriodIncomeInTransaction,
  type PeriodPreparationMutation,
} from './period-preparation';
import { activeRowFilter } from './soft-delete';
import {
  completeDraftInputSchema,
  editTransactionInputSchema,
  parseCreateTransactionInput,
  parseTransaction,
  transactionIdSchema,
  type CompleteDraftInput,
  type CreateTransactionInput,
  type EditTransactionInput,
  type Transaction,
} from './transaction-validation';
import {
  accounts,
} from './schema';
import {
  createTransactionData,
  type TransactionData,
} from './transactions';
import {
  ledgerChangeNotifier,
  type LedgerChangeNotifier,
} from './ledger-change-notifier';

type EditableDirection = 'expense' | 'income';

type AcceptedManualChanges = {
  accountId?: string;
  direction?: Transaction['direction'];
  amount?: number | null;
  categoryId?: string | null;
  quality?: Transaction['quality'];
  occurredAt?: Date;
  note?: string | null;
  sourceLabel?: string | null;
  adjustmentEffect?: 'increase' | 'decrease' | null;
};

export type ManualTransactionDataOptions<TResultKind extends 'sync' | 'async'> = {
  runAtomic?: AtomicTransactionRunner<TResultKind>;
  now?: () => Date;
};

export type ManualTransactionData<TResultKind extends 'sync' | 'async'> = Pick<
  TransactionData<TResultKind>,
  'createTransaction' | 'editTransaction' | 'completeDraft' | 'softDeleteTransaction'
>;

function manualDirectionRequired(): Error {
  return new Error('Manual transactions must use expense or income direction');
}

function completeManualTransactionRequired(): Error {
  return new Error('Manual transaction creation requires a complete transaction');
}

function manualExpenseCategoryRequired(): Error {
  return new Error('A complete expense requires an active leaf category');
}

function activeAccountWriteFailed(accountId: string): Error {
  return new Error(`Active account ${accountId} was not found`);
}

function mergePeriodMutation(
  left: PeriodPreparationMutation,
  right: PeriodPreparationMutation
): PeriodPreparationMutation {
  if (left === 'created' || right === 'created') return 'created';
  if (left === 'edited' || right === 'edited') return 'edited';
  return 'none';
}

async function requireActiveAccount<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  accountId: string
): Promise<void> {
  const row = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), activeRowFilter(accounts.deletedAt)))
    .get();
  if (row === undefined) throw activeAccountWriteFailed(accountId);
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

function normalizeManualChanges(changes: AcceptedManualChanges): AcceptedManualChanges {
  const normalized: AcceptedManualChanges = {};
  if (changes.accountId !== undefined) normalized.accountId = changes.accountId;
  if (changes.direction !== undefined) normalized.direction = changes.direction;
  if (changes.amount !== undefined) normalized.amount = changes.amount;
  if (changes.categoryId !== undefined) normalized.categoryId = changes.categoryId;
  if (changes.quality !== undefined) normalized.quality = changes.quality;
  if (changes.occurredAt !== undefined) normalized.occurredAt = changes.occurredAt;
  if (changes.note !== undefined) normalized.note = optionalManualText(changes.note);
  if (changes.sourceLabel !== undefined) {
    normalized.sourceLabel = optionalManualText(changes.sourceLabel);
  }
  return normalized;
}

function directionIsManual(direction: Transaction['direction']): direction is EditableDirection {
  return direction === 'expense' || direction === 'income';
}

function manualEditChanges(
  existing: Transaction,
  changes: EditTransactionInput['changes']
): AcceptedManualChanges {
  const normalized = normalizeManualChanges(changes);
  const direction = normalized.direction ?? existing.direction;
  const result: AcceptedManualChanges = {
    ...normalized,
    adjustmentEffect: null,
  };

  if (normalized.direction !== undefined) result.direction = direction;
  if (direction === 'income') {
    result.categoryId = null;
  } else if (normalized.categoryId !== undefined) {
    result.categoryId = normalized.categoryId;
  }
  if (direction === 'expense') {
    result.sourceLabel = null;
  }
  return result;
}

function manualEditCandidate(
  existing: Transaction,
  changes: EditTransactionInput['changes']
): Transaction {
  const normalized = manualEditChanges(existing, changes);
  const direction = normalized.direction ?? existing.direction;
  if (!directionIsManual(direction)) throw manualDirectionRequired();
  return parseTransaction({ ...existing, ...normalized });
}

type CompletionCandidate = {
  candidate: Transaction;
  changes: AcceptedManualChanges;
  categoryId: string | null;
};

function manualCompletionCandidate(
  existing: Transaction,
  parsed: CompleteDraftInput
): CompletionCandidate {
  const normalized = normalizeManualChanges(parsed.changes ?? {});
  const direction = normalized.direction ?? existing.direction;
  if (!directionIsManual(direction)) throw manualDirectionRequired();
  const categoryId =
    direction === 'income'
      ? null
      : parsed.categoryId === undefined
        ? existing.categoryId
        : parsed.categoryId;
  const changes: AcceptedManualChanges = {
    ...normalized,
    direction,
    adjustmentEffect: null,
  };
  if (direction === 'income') {
    if (normalized.sourceLabel !== undefined) changes.sourceLabel = normalized.sourceLabel;
  } else {
    changes.sourceLabel = null;
  }
  const candidate = parseTransaction({
    ...existing,
    ...changes,
    status: 'complete',
    amount: parsed.amount,
    categoryId,
  });
  return { candidate, changes, categoryId };
}

async function readActiveTransaction<TResultKind extends 'sync' | 'async'>(
  data: TransactionData<TResultKind>,
  transactionId: string
): Promise<Transaction> {
  const transaction = await data.readTransaction(transactionId);
  if (transaction === undefined) {
    throw new Error(`Active transaction ${transactionId} was not found`);
  }
  return transaction;
}

function notifyManualMutation(
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

export function createManualTransactionData<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  _categoryData: CategoryData<TResultKind> = createCategoryData(db),
  changeNotifier: LedgerChangeNotifier = ledgerChangeNotifier,
  options: ManualTransactionDataOptions<TResultKind> = {}
): ManualTransactionData<TResultKind> {
  const runAtomic = options.runAtomic ?? createDefaultAtomicRunner(db);
  const now = options.now ?? (() => new Date());
  const silentNotifier: LedgerChangeNotifier = {
    subscribe: () => () => undefined,
    notify: () => undefined,
  };

  async function runManualMutation<T>(
    operation: (
      db: LedgerDatabase<TResultKind>,
      transactionData: TransactionData<TResultKind>,
      categoryData: CategoryData<TResultKind>,
      at: Date
    ) => Promise<T>,
    mutation: 'created' | 'edited' | 'completed' | 'deleted',
    preflight?: (
      db: LedgerDatabase<TResultKind>,
      transactionData: TransactionData<TResultKind>,
      categoryData: CategoryData<TResultKind>,
      at: Date
    ) => Promise<void>
  ): Promise<T> {
    const at = now();
    const result = await runAtomic(async (transactionDb) => {
      const transactionCategoryData = createCategoryData(transactionDb, silentNotifier);
      const transactionService = createTransactionData(
        transactionDb,
        transactionCategoryData,
        silentNotifier
      );
      await preflight?.(
        transactionDb,
        transactionService,
        transactionCategoryData,
        at
      );
      const preparation = await prepareCurrentPeriodInTransaction(transactionDb, at);
      const value = await operation(
        transactionDb,
        transactionService,
        transactionCategoryData,
        at
      );
      const incomeMutation = await refreshCurrentPeriodIncomeInTransaction(
        transactionDb,
        currentPeriod(at),
        at
      );
      return {
        value,
        periodMutation: mergePeriodMutation(preparation.mutation, incomeMutation),
      };
    });
    notifyManualMutation(changeNotifier, result.periodMutation, mutation);
    return result.value;
  }

  return {
    async createTransaction(input: unknown): Promise<Transaction> {
      const parsed = normalizeManualCreate(parseCreateTransactionInput(input));
      return runManualMutation(
        (_db, transactionData) => transactionData.createTransaction(parsed),
        'created',
        async (transactionDb, _transactionData, categoryData, at) => {
          assertManualOccurredAt(parsed.occurredAt, at);
          await requireActiveAccount(transactionDb, parsed.accountId);
          if (parsed.direction === 'expense' && parsed.categoryId !== null) {
            await categoryData.requireActiveLeafCategory(parsed.categoryId);
          }
        }
      );
    },

    async editTransaction(input: unknown): Promise<Transaction> {
      const edit = editTransactionInputSchema.parse(input);
      return runManualMutation(
        (_db, transactionData) =>
          readActiveTransaction(transactionData, edit.transactionId).then((existing) =>
            transactionData.editTransaction({
              transactionId: edit.transactionId,
              changes: manualEditChanges(existing, edit.changes),
            })
          ),
        'edited',
        async (transactionDb, transactionData, categoryData, at) => {
          const existing = await readActiveTransaction(transactionData, edit.transactionId);
          const candidate = manualEditCandidate(existing, edit.changes);
          assertManualOccurredAt(candidate.occurredAt, at);
          if (
            edit.changes.accountId !== undefined &&
            edit.changes.accountId !== existing.accountId
          ) {
            await requireActiveAccount(transactionDb, edit.changes.accountId);
          }
          if (
            candidate.categoryId !== null &&
            (edit.changes.categoryId !== undefined ||
              (edit.changes.direction === 'expense' && existing.direction !== 'expense'))
          ) {
            await categoryData.requireActiveLeafCategory(candidate.categoryId);
          }
        }
      );
    },

    async completeDraft(input: unknown): Promise<Transaction> {
      const complete = completeDraftInputSchema.parse(input);
      return runManualMutation(
        (_db, transactionData) => {
          return readActiveTransaction(transactionData, complete.transactionId).then((existing) => {
            const prepared = manualCompletionCandidate(existing, complete);
            return transactionData.completeDraft({
              transactionId: complete.transactionId,
              amount: complete.amount,
              categoryId: prepared.categoryId,
              changes: prepared.changes,
            });
          });
        },
        'completed',
        async (transactionDb, transactionData, categoryData, at) => {
          const existing = await readActiveTransaction(transactionData, complete.transactionId);
          const prepared = manualCompletionCandidate(existing, complete);
          assertManualOccurredAt(prepared.candidate.occurredAt, at);
          await requireActiveAccount(transactionDb, prepared.candidate.accountId);
          if (prepared.candidate.direction === 'expense') {
            if (prepared.candidate.categoryId === null) {
              throw manualExpenseCategoryRequired();
            }
            await categoryData.requireActiveLeafCategory(prepared.candidate.categoryId);
          }
        }
      );
    },

    async softDeleteTransaction(transactionId: unknown): Promise<void> {
      const parsedId = transactionIdSchema.parse(transactionId);
      await runManualMutation(
        (_db, transactionData) => transactionData.softDeleteTransaction(parsedId),
        'deleted',
        async (_db, transactionData) => {
          await readActiveTransaction(transactionData, parsedId);
        }
      );
    },
  };
}

export type { LedgerDatabase } from './atomic';
