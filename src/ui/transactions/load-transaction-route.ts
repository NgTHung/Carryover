/**
 * Validates a transaction route before it reaches the public data API.
 *
 * Route parameters are untrusted strings. Keeping this check outside the
 * screen makes it impossible for an invalid deep link to become a database
 * read by accident.
 */
import {
  transactionIdSchema,
  type Transaction,
} from '../../data/transaction-validation';

export type ParsedTransactionRoute =
  | { status: 'valid'; transactionId: string }
  | { status: 'invalid'; message: string };

export type LoadedTransactionRoute =
  | { status: 'invalid'; message: string }
  | { status: 'unavailable'; transactionId: string }
  | { status: 'ready'; transaction: Transaction };

export function parseTransactionRoute(
  value: unknown
): ParsedTransactionRoute {
  const parsed = transactionIdSchema.safeParse(value);
  return parsed.success
    ? { status: 'valid', transactionId: parsed.data }
    : { status: 'invalid', message: 'This transaction link is invalid.' };
}

export async function loadTransactionRoute(
  value: unknown,
  readTransaction: (
    transactionId: string
  ) => Promise<Transaction | undefined>
): Promise<LoadedTransactionRoute> {
  const parsed = parseTransactionRoute(value);
  if (parsed.status === 'invalid') {
    return parsed;
  }

  const transaction = await readTransaction(parsed.transactionId);
  return transaction === undefined
    ? { status: 'unavailable', transactionId: parsed.transactionId }
    : { status: 'ready', transaction };
}
