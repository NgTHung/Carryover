/**
 * Builds the pure budget input from one consistent view of the ledger.
 *
 * The native composition root supplies services bound to an exclusive SQLite
 * read transaction. This module only normalizes their domain values for
 * `computeBudget`, which keeps database access outside the arithmetic engine.
 */
import type { AccountData } from '../data/accounts';
import type { CommitmentData } from '../data/commitments';
import { dateOnlyFromLocalDate } from '../data/date-only';
import type { MonthConfigData } from '../data/month-config';
import { currentPeriod } from '../data/period';
import type { ShareData } from '../data/shares';
import type { TransactionData } from '../data/transactions';
import type { BudgetInput, BudgetShare } from './compute-budget';

export type BudgetSnapshotReads = {
  accounts: Pick<AccountData<'sync'>, 'readAccountBalances'>;
  commitments: Pick<CommitmentData<'sync'>, 'readReservedUnpaid'>;
  monthConfig: Pick<MonthConfigData<'sync'>, 'readMonthConfig'>;
  shares: Pick<ShareData<'sync'>, 'readShares'>;
  transactions: Pick<TransactionData<'sync'>, 'readTransactions'>;
};

export type BudgetInputWithoutWriteTime = Omit<BudgetInput, 'updatedAt'>;

export async function readBudgetInput(
  reads: BudgetSnapshotReads,
  now: Date
): Promise<BudgetInputWithoutWriteTime> {
  const period = currentPeriod(now);
  const config = await reads.monthConfig.readMonthConfig(period);
  if (config === undefined) {
    throw new Error(`Current period ${period} has no stored month config`);
  }

  const [accounts, transactions, shares, reservedUnpaid] = await Promise.all([
    reads.accounts.readAccountBalances(),
    reads.transactions.readTransactions(),
    reads.shares.readShares(),
    reads.commitments.readReservedUnpaid(period),
  ]);

  return {
    today: dateOnlyFromLocalDate(now),
    monthConfig: {
      period: config.period,
      horizonDate: config.horizonDate,
    },
    accountBalances: accounts.map((account) => account.balance),
    reservedUnpaid,
    transactions: transactions.map((transaction) => {
      const base = {
        id: transaction.id,
        direction: transaction.direction,
        payer: transaction.payer,
        quality: transaction.quality,
        occurredOn: dateOnlyFromLocalDate(transaction.occurredAt),
      };
      return transaction.status === 'complete'
        ? { ...base, status: transaction.status, amount: transaction.amount }
        : { ...base, status: transaction.status, amount: transaction.amount };
    }),
    shares: shares.map(
      (share): BudgetShare => ({
        transactionId: share.transactionId,
        contactId: share.contactId,
        shareAmount: share.shareAmount,
      })
    ),
    owedToYou: 0,
  };
}
