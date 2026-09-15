/**
 * Writes one photo-backed expense draft as an idempotent SQLite operation.
 *
 * Photo retention and SQLite commit are separate boundaries. This service only
 * accepts a validated retained key, prepares the period in the same SQLite
 * transaction, and reports a replay without emitting a second ledger event.
 */
import { and, eq } from 'drizzle-orm';

import {
  createDefaultAtomicRunner,
  type AtomicTransactionRunner,
  type LedgerDatabase,
} from './atomic';
import {
  parseCapturedDraftInput,
  type CreateCapturedDraftInput,
} from './captured-draft-validation';
import {
  ledgerChangeNotifier,
  type LedgerChangeNotifier,
} from './ledger-change-notifier';
import { assertManualOccurredAt } from './manual-transaction-policy';
import { prepareCurrentPeriodInTransaction } from './period-preparation';
import { accounts, transactions } from './schema';
import { activeRowFilter } from './soft-delete';
import {
  parseTransaction,
  type DraftTransaction,
  type Transaction,
} from './transaction-validation';

type CapturedDraftDataOptions<TResultKind extends 'sync' | 'async'> = {
  runAtomic?: AtomicTransactionRunner<TResultKind>;
  now?: () => Date;
};

export type CapturedDraftWriteResult = {
  status: 'created' | 'existing';
  transaction: DraftTransaction;
};

type CaptureFields = {
  accountId: string;
  amount: number | null;
  occurredAt: Date;
  photoKey: string;
};

function defaultAccountRequired(): Error {
  return new Error('Capture requires exactly one active default account');
}

function captureCollision(draftId: string): Error {
  return new Error(`Capture draft ${draftId} conflicts with an existing transaction`);
}

function insertedDraftMissing(draftId: string): Error {
  return new Error(`Capture draft ${draftId} was not returned after insertion`);
}

function asDraft(transaction: Transaction, draftId: string): DraftTransaction {
  if (transaction.status !== 'draft') {
    throw captureCollision(draftId);
  }
  return transaction;
}

function matchesCaptureFields(
  row: typeof transactions.$inferSelect,
  expected: CaptureFields
): boolean {
  return (
    row.deletedAt === null &&
    row.accountId === expected.accountId &&
    row.direction === 'expense' &&
    row.adjustmentEffect === null &&
    row.amount === expected.amount &&
    row.categoryId === null &&
    row.quality === null &&
    row.payerContactId === null &&
    row.occurredAt.getTime() === expected.occurredAt.getTime() &&
    row.status === 'draft' &&
    row.photoKey === expected.photoKey &&
    row.note === null &&
    row.sourceLabel === null
  );
}

async function activeDefaultAccount<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>
): Promise<string> {
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(eq(accounts.isDefault, true), activeRowFilter(accounts.deletedAt))
    )
    .all();
  if (rows.length !== 1) {
    throw defaultAccountRequired();
  }
  return rows[0].id;
}

async function readById<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  draftId: string
): Promise<typeof transactions.$inferSelect | undefined> {
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.id, draftId))
    .get() as typeof transactions.$inferSelect | undefined;
}

function parseExistingDraft(
  row: typeof transactions.$inferSelect,
  draftId: string
): DraftTransaction {
  try {
    return asDraft(
      parseTransaction({
        id: row.id,
        accountId: row.accountId,
        direction: row.direction,
        adjustmentEffect: row.adjustmentEffect,
        amount: row.amount,
        categoryId: row.categoryId,
        quality: row.quality,
        payer: row.payerContactId === null
          ? { kind: 'you' }
          : { kind: 'contact', contactId: row.payerContactId },
        occurredAt: row.occurredAt,
        status: row.status,
        photoKey: row.photoKey,
        note: row.note,
        sourceLabel: row.sourceLabel,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      }),
      draftId
    );
  } catch (error: unknown) {
    throw new Error(`Capture draft ${draftId} could not be read for retry`, {
      cause: error,
    });
  }
}

export function createCapturedDraftData<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  changeNotifier: LedgerChangeNotifier = ledgerChangeNotifier,
  options: CapturedDraftDataOptions<TResultKind> = {}
) {
  const runAtomic = options.runAtomic ?? createDefaultAtomicRunner(db);
  const now = options.now ?? (() => new Date());

  return {
    async createCapturedDraft(
      input: CreateCapturedDraftInput | unknown
    ): Promise<CapturedDraftWriteResult> {
      const parsed = parseCapturedDraftInput(input);
      const at = now();
      assertManualOccurredAt(parsed.occurredAt, at);

      const result = await runAtomic(async (transactionDb) => {
        const accountId = await activeDefaultAccount(transactionDb);
        const preparation = await prepareCurrentPeriodInTransaction(
          transactionDb,
          at
        );
        const expected: CaptureFields = {
          accountId,
          amount: parsed.amount,
          occurredAt: parsed.occurredAt,
          photoKey: parsed.photoKey,
        };
        const inserted = await transactionDb
          .insert(transactions)
          .values({
            id: parsed.draftId,
            accountId,
            direction: 'expense',
            adjustmentEffect: null,
            amount: parsed.amount,
            categoryId: null,
            quality: null,
            payerContactId: null,
            occurredAt: parsed.occurredAt,
            status: 'draft',
            photoKey: parsed.photoKey,
            note: null,
            sourceLabel: null,
          })
          .onConflictDoNothing({ target: transactions.id })
          .returning()
          .get();

        if (inserted !== undefined) {
          const transaction = parseExistingDraft(inserted, parsed.draftId);
          return {
            status: 'created' as const,
            transaction,
            periodMutation: preparation.mutation,
          };
        }

        const existing = await readById(transactionDb, parsed.draftId);
        if (
          existing === undefined ||
          !matchesCaptureFields(existing, expected)
        ) {
          throw captureCollision(parsed.draftId);
        }
        return {
          status: 'existing' as const,
          transaction: parseExistingDraft(existing, parsed.draftId),
          periodMutation: preparation.mutation,
        };
      });

      if (result.periodMutation !== 'none') {
        changeNotifier.notify({
          table: 'month_config',
          mutation: result.periodMutation === 'created' ? 'created' : 'edited',
        });
      }
      if (result.status === 'created') {
        changeNotifier.notify({ table: 'transactions', mutation: 'created' });
      }
      return {
        status: result.status,
        transaction: result.transaction,
      };
    },
  };
}

export type CapturedDraftData<TResultKind extends 'sync' | 'async'> = ReturnType<
  typeof createCapturedDraftData<TResultKind>
>;
