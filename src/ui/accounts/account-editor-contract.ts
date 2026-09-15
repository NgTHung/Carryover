/** Native account operations used by the Accounts route and its controls. */
import type { EditAccountDetails, ReconcileAccount } from '../../data/account-validation';
import type { AccountBalance, ReconcileResult } from '../../data/accounts';

export type AccountEditorData = {
  readAccountBalances(): Promise<AccountBalance[]>;
  editAccountDetails(input: EditAccountDetails): Promise<void>;
  reconcileAccount(input: ReconcileAccount): Promise<ReconcileResult>;
};
