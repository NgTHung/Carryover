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
export const readTransaction = unavailable;
