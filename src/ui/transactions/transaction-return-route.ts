/**
 * Maps the editor's optional origin to one of the app's fixed destinations.
 *
 * A route parameter is untrusted input, so only the exact Drafts origin can
 * change the return path. Every other value keeps ordinary transaction flow.
 */
export const TRANSACTION_RETURN_ROUTE = {
  destination: '/transactions',
  label: 'Back to transactions',
  navigation: 'replace',
} as const;

export const DRAFT_RETURN_ROUTE = {
  destination: '/drafts',
  label: 'Back to drafts',
  navigation: 'dismissTo',
} as const;

export type TransactionReturnRoute =
  | typeof TRANSACTION_RETURN_ROUTE
  | typeof DRAFT_RETURN_ROUTE;

export function parseTransactionReturnRoute(value: unknown): TransactionReturnRoute {
  return value === 'drafts' ? DRAFT_RETURN_ROUTE : TRANSACTION_RETURN_ROUTE;
}
