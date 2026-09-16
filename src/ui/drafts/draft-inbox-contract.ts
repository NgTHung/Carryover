/**
 * Contracts shared by the draft inbox hook and presentation.
 *
 * The UI needs only one read operation. Keeping that dependency narrow makes
 * it clear that loading the inbox cannot mutate the ledger or publish budget.
 */
import type { DraftTransaction } from '../../data/transaction-validation';

export type DraftInboxReader = {
  readActiveDrafts: () => Promise<DraftTransaction[]>;
};

export type DraftInboxLoadState =
  | { status: 'loading' }
  | { status: 'ready'; drafts: DraftTransaction[] }
  | { status: 'error'; message: string };

export function draftInboxErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
