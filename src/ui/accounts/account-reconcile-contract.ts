/** @deprecated Use AccountEditorData for the complete account contract. */
import type { AccountEditorData } from './account-editor-contract';

export type AccountReconcileData = Pick<
  AccountEditorData,
  'readAccountBalances' | 'reconcileAccount'
>;
