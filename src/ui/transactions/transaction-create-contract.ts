/**
 * Native operations needed to create one complete manual transaction.
 *
 * The route reads choices separately from the mutation so loading failures do
 * not become partial writes and the creator stays independent of SQLite.
 */
import type { ActiveAccount } from '../../data/accounts';
import type { CategoryGroupWithLeaves } from '../../data/category-types';
import type { CommitmentOverview } from '../../data/commitment-overview';
import type { CreateReservePaymentInput } from '../../data/reserve-payments';
import type {
  CreateTransactionInput,
  Transaction,
} from '../../data/transaction-validation';

export type TransactionCreateData = {
  listActiveAccounts(): Promise<ActiveAccount[]>;
  listActiveCategoryGroups(): Promise<CategoryGroupWithLeaves[]>;
  readCommitmentOverview(period: unknown): Promise<CommitmentOverview>;
  createCompleteTransaction(input: CreateTransactionInput): Promise<Transaction>;
  createReservePayment(input: CreateReservePaymentInput): Promise<Transaction>;
};
