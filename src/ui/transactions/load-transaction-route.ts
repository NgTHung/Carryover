/**
 * Validates a transaction route before it reaches the public data API.
 *
 * Route parameters are untrusted strings. Keeping this check outside the
 * screen makes it impossible for an invalid deep link to become a database
 * read by accident.
 */
import {
  commitmentIdSchema,
} from '../../data/commitment-validation';
import type { CommitmentOverview } from '../../data/commitment-overview';
import { periodSchema, type Period } from '../../data/period';
import {
  transactionIdSchema,
  type Transaction,
} from '../../data/transaction-validation';

export type ParsedTransactionRoute =
  | { status: 'valid'; transactionId: string }
  | { status: 'invalid'; message: string };

export type TransactionCreationDirection = 'expense' | 'income';

export type TransactionCreationIntent =
  | {
      kind: 'manual';
      initialDirection: TransactionCreationDirection;
    }
  | {
      kind: 'reserve-payment';
      commitmentId: string;
      period: Period;
    };

export type ParsedTransactionCreationIntentRoute =
  | { status: 'valid'; intent: TransactionCreationIntent }
  | { status: 'invalid'; message: string };

export type ParsedTransactionCreationRoute =
  | { status: 'valid'; direction: TransactionCreationDirection }
  | { status: 'invalid'; message: string };

export type ReservePaymentPresentation = {
  kind: 'reserve-payment';
  commitmentId: string;
  commitmentName: string;
  reservedAmount: number;
  period: Period;
  categoryId: string;
  leafName: string;
};

export type ResolvedReservePaymentIntent =
  | { status: 'ready'; intent: ReservePaymentPresentation }
  | { status: 'unavailable'; message: string };

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

export function parseTransactionCreationRoute(
  params: {
    direction?: unknown;
    mode?: unknown;
    commitmentId?: unknown;
    period?: unknown;
  }
): ParsedTransactionCreationIntentRoute;
export function parseTransactionCreationRoute(
  direction: unknown
): ParsedTransactionCreationRoute;
export function parseTransactionCreationRoute(
  value:
    | {
        direction?: unknown;
        mode?: unknown;
        commitmentId?: unknown;
        period?: unknown;
      }
    | unknown
): ParsedTransactionCreationIntentRoute | ParsedTransactionCreationRoute {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    if (value === undefined || value === 'expense') {
      return { status: 'valid', direction: 'expense' };
    }
    if (value === 'income') {
      return { status: 'valid', direction: 'income' };
    }
    return {
      status: 'invalid',
      message: 'This transaction creation link is invalid.',
    };
  }
  const params = value as {
    direction?: unknown;
    mode?: unknown;
    commitmentId?: unknown;
    period?: unknown;
  };
  const { direction, mode, commitmentId, period } = params;
  if (
    mode === undefined &&
    commitmentId === undefined &&
    period === undefined
  ) {
    if (direction === undefined || direction === 'expense') {
      return {
        status: 'valid',
        intent: { kind: 'manual', initialDirection: 'expense' },
      };
    }
    if (direction === 'income') {
      return {
        status: 'valid',
        intent: { kind: 'manual', initialDirection: 'income' },
      };
    }
  }

  if (mode === 'reserve-payment' && direction === undefined) {
    const parsedCommitmentId = commitmentIdSchema.safeParse(commitmentId);
    const parsedPeriod = periodSchema.safeParse(period);
    if (parsedCommitmentId.success && parsedPeriod.success) {
      return {
        status: 'valid',
        intent: {
          kind: 'reserve-payment',
          commitmentId: parsedCommitmentId.data,
          period: parsedPeriod.data as Period,
        },
      };
    }
  }
  return {
    status: 'invalid',
    message: 'This transaction creation link is invalid.',
  };
}

export function resolveReservePaymentIntent(
  overview: CommitmentOverview,
  commitmentId: string
): ResolvedReservePaymentIntent {
  const item = overview.items.find(
    ({ commitment }) => commitment.id === commitmentId
  );
  if (item === undefined) {
    return {
      status: 'unavailable',
      message: 'This commitment is no longer available.',
    };
  }
  if (item.state.status === 'inactive') {
    return {
      status: 'unavailable',
      message: 'Activate this commitment before recording its payment.',
    };
  }
  if (!item.leaf.active) {
    return {
      status: 'unavailable',
      message: 'Choose an active reserve leaf before recording this payment.',
    };
  }
  if (item.state.status === 'paid') {
    return {
      status: 'unavailable',
      message: 'This commitment is already paid for the selected period.',
    };
  }
  if (!item.state.nextToAcceptPayment) {
    return {
      status: 'unavailable',
      message: 'Record the earlier commitment for this reserve leaf first.',
    };
  }
  return {
    status: 'ready',
    intent: {
      kind: 'reserve-payment',
      commitmentId: item.commitment.id,
      commitmentName: item.commitment.name,
      reservedAmount: item.commitment.amount,
      period: overview.period,
      categoryId: item.commitment.categoryId,
      leafName: item.leaf.name ?? 'Unavailable reserve leaf',
    },
  };
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
