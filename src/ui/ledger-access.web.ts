/**
 * Refuses ledger access if a native route is invoked in the browser preview.
 *
 * The web routes render without these calls, but their fallback modules still
 * enter the bundle during route discovery.
 */
function unavailable(): never {
  throw new Error('The browser preview does not open the ledger.');
}

export const useLedgerMigrations = unavailable;
export const getCategoryEditorData = unavailable;
export const getAccountReconcileData = unavailable;
export const getAccountEditorData = unavailable;
export const getCommitmentManagerData = unavailable;
export const getHorizonEditorData = unavailable;
export const readTransaction = unavailable;
export const getTransactionListData = unavailable;
export const getMonthSummaryData = unavailable;
export const subscribeLedgerChanges = unavailable;
export const getTransactionEditorData = unavailable;
export const getTransactionCreateData = unavailable;
export const retryBudgetSnapshot = unavailable;
