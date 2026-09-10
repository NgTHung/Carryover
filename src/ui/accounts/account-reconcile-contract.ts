/**
 * Native operations needed by the accounts and reconcile screen.
 *
 * The screen owns form state, while the data boundary owns validation and the
 * adjustment write. Keeping this contract here lets the browser route render
 * without importing the native database module.
 */
import type { AccountBalance, ReconcileResult } from '../../data/accounts';

export type AccountReconcileData = {
  readAccountBalances(): Promise<AccountBalance[]>;
  reconcileAccount(input: {
    accountId: string;
    statedBalance: number;
    occurredAt: Date;
  }): Promise<ReconcileResult>;
};
