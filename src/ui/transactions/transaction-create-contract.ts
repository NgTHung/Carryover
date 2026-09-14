/**
 * Native operations needed to create one complete manual transaction.
 *
 * The route reads choices separately from the mutation so loading failures do
 * not become partial writes and the creator stays independent of SQLite.
 */
import type { ActiveAccount } from '../../data/accounts';
import type { CategoryGroupWithLeaves } from '../../data/category-types';
import type {
  CreateTransactionInput,
  Transaction,
} from '../../data/transaction-validation';

export type TransactionCreateData = {
  listActiveAccounts(): Promise<ActiveAccount[]>;
  listActiveCategoryGroups(): Promise<CategoryGroupWithLeaves[]>;
  createCompleteTransaction(input: CreateTransactionInput): Promise<Transaction>;
};
