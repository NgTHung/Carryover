/**
 * Atomically validate a reserve-payment intent and record its ordinary expense.
 *
 * The transaction stores no commitment reference. Eligibility protects the
 * action the user selected, while the period-and-category matcher remains the
 * authority for which commitment the committed expense clears.
 */
import { z } from 'zod';

import {
  createDefaultAtomicRunner,
  type AtomicTransactionRunner,
  type LedgerDatabase,
} from './atomic';
import { readCommitmentPeriodInputs } from './commitment-overview';
import { commitmentIdSchema } from './commitment-validation';
import {
  createCompleteManualTransactionInTransaction,
  notifyManualTransactionMutation,
} from './manual-transaction-atomic';
import {
  currentPeriod,
  periodSchema,
  type Period,
} from './period';
import {
  ledgerChangeNotifier,
  type LedgerChangeNotifier,
} from './ledger-change-notifier';
import {
  parseCreateTransactionInput,
  type CreateTransactionInput,
  type Transaction,
} from './transaction-validation';

export type CreateReservePaymentInput = {
  commitmentId: string;
  period: Period;
  transaction: CreateTransactionInput;
};

export type ReservePaymentDataOptions<TResultKind extends 'sync' | 'async'> = {
  runAtomic?: AtomicTransactionRunner<TResultKind>;
  now?: () => Date;
};

const reservePaymentContainerSchema = z
  .object({
    commitmentId: commitmentIdSchema,
    period: periodSchema,
    transaction: z.unknown(),
  })
  .strict();

function parseReservePaymentInput(input: unknown): CreateReservePaymentInput {
  const parsed = reservePaymentContainerSchema.parse(input);
  return {
    commitmentId: parsed.commitmentId,
    period: parsed.period,
    transaction: parseCreateTransactionInput(parsed.transaction),
  };
}

function ineligible(message: string): Error {
  return new Error(`Reserve payment is unavailable: ${message}`);
}

export function createReservePaymentData<
  TResultKind extends 'sync' | 'async',
>(
  db: LedgerDatabase<TResultKind>,
  changeNotifier: LedgerChangeNotifier = ledgerChangeNotifier,
  options: ReservePaymentDataOptions<TResultKind> = {}
) {
  const runAtomic = options.runAtomic ?? createDefaultAtomicRunner(db);
  const now = options.now ?? (() => new Date());

  return {
    async createReservePayment(input: unknown): Promise<Transaction> {
      const parsed = parseReservePaymentInput(input);
      const at = now();
      const result = await runAtomic(async (transactionDb) => {
        const periodInputs = await readCommitmentPeriodInputs(
          transactionDb,
          parsed.period
        );
        const target = periodInputs.commitments.find(
          ({ commitment }) => commitment.id === parsed.commitmentId
        );
        if (target === undefined) throw ineligible('commitment was not found');
        if (!target.commitment.active) throw ineligible('commitment is inactive');
        if (!target.leaf.active) throw ineligible('reserve leaf is inactive');

        const match = periodInputs.matches.find(
          ({ commitment }) => commitment.id === target.commitment.id
        );
        if (match === undefined) throw ineligible('commitment status is unavailable');
        if (match.status === 'paid') throw ineligible('commitment is already paid');
        const nextForLeaf = periodInputs.matches.find(
          (candidate) =>
            candidate.status === 'unpaid' &&
            candidate.commitment.categoryId === target.commitment.categoryId
        );
        if (nextForLeaf?.commitment.id !== target.commitment.id) {
          throw ineligible('an earlier commitment must be paid first');
        }

        const transaction = parsed.transaction;
        if (
          transaction.status !== 'complete' ||
          transaction.direction !== 'expense' ||
          transaction.categoryId !== target.commitment.categoryId
        ) {
          throw ineligible('expense does not match the commitment');
        }
        if (currentPeriod(transaction.occurredAt) !== parsed.period) {
          throw ineligible('expense date must belong to the selected period');
        }

        return createCompleteManualTransactionInTransaction(
          transactionDb,
          transaction,
          at
        );
      });

      notifyManualTransactionMutation(
        changeNotifier,
        result.periodMutation,
        'created'
      );
      return result.transaction;
    },
  };
}

export type ReservePaymentData<TResultKind extends 'sync' | 'async'> = ReturnType<
  typeof createReservePaymentData<TResultKind>
>;
