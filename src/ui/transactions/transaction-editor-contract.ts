/**
 * Typed operations needed by the transaction editor route.
 *
 * The route receives this facade instead of importing individual database
 * modules, so native access stays at one boundary and browser access stays
 * unavailable.
 */
import type { AccountBalance } from '../../data/accounts';
import type { CategoryGroupWithLeaves } from '../../data/category-types';
import type {
  CompleteDraftInput,
  EditTransactionInput,
  Transaction,
} from '../../data/transaction-validation';

export type TransactionEditorData = {
  readTransaction(id: string): Promise<Transaction | undefined>;
  listActiveCategoryGroups(): Promise<CategoryGroupWithLeaves[]>;
  readAccountBalances(): Promise<AccountBalance[]>;
  editTransaction(input: EditTransactionInput): Promise<Transaction>;
  completeDraft(input: CompleteDraftInput): Promise<Transaction>;
  softDeleteTransaction(id: string): Promise<void>;
};
