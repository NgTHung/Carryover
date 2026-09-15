import {
  loadTransactionRoute,
  parseTransactionCreationRoute,
  parseTransactionRoute,
  resolveReservePaymentIntent,
} from '../src/ui/transactions/load-transaction-route';
import type { Transaction } from '../src/data/transaction-validation';
import type { CommitmentOverview } from '../src/data/commitment-overview';

const transactionId = '11111111-1111-4111-8111-111111111111';
const commitmentId = '22222222-2222-4222-8222-222222222222';

test('accepts expense, income, and a bare creation route only', () => {
  expect(parseTransactionCreationRoute({})).toEqual({
    status: 'valid',
    intent: { kind: 'manual', initialDirection: 'expense' },
  });
  expect(parseTransactionCreationRoute({ direction: 'expense' })).toEqual({
    status: 'valid',
    intent: { kind: 'manual', initialDirection: 'expense' },
  });
  expect(parseTransactionCreationRoute({ direction: 'income' })).toEqual({
    status: 'valid',
    intent: { kind: 'manual', initialDirection: 'income' },
  });
  expect(parseTransactionCreationRoute({ direction: 'transfer' })).toEqual({
    status: 'invalid',
    message: 'This transaction creation link is invalid.',
  });
  expect(parseTransactionCreationRoute({ direction: ['expense'] })).toEqual({
    status: 'invalid',
    message: 'This transaction creation link is invalid.',
  });
  expect(parseTransactionCreationRoute({ direction: ['expense', 'income'] })).toEqual({
    status: 'invalid',
    message: 'This transaction creation link is invalid.',
  });
  expect(parseTransactionCreationRoute({ direction: null })).toEqual({
    status: 'invalid',
    message: 'This transaction creation link is invalid.',
  });
});

test('accepts only a complete reserve-payment route intent', () => {
  expect(
    parseTransactionCreationRoute({
      mode: 'reserve-payment',
      commitmentId,
      period: '2026-09',
    })
  ).toEqual({
    status: 'valid',
    intent: {
      kind: 'reserve-payment',
      commitmentId,
      period: '2026-09',
    },
  });

  for (const params of [
    { mode: 'reserve-payment', commitmentId },
    { mode: 'reserve-payment', period: '2026-09' },
    { mode: 'reserve-payment', commitmentId, period: '2026-13' },
    { mode: 'reserve-payment', commitmentId: [commitmentId], period: '2026-09' },
    { mode: ['reserve-payment'], commitmentId, period: '2026-09' },
    { mode: 'reserve-payment', direction: 'expense', commitmentId, period: '2026-09' },
    { commitmentId, period: '2026-09' },
  ]) {
    expect(parseTransactionCreationRoute(params)).toEqual({
      status: 'invalid',
      message: 'This transaction creation link is invalid.',
    });
  }
});

function overview(
  state: CommitmentOverview['items'][number]['state'],
  leafActive = true
): CommitmentOverview {
  return {
    period: '2026-09',
    unpaidTotal: { status: 'available', amount: 700_000 },
    items: [
      {
        commitment: {
          id: commitmentId,
          name: 'Rent',
          amount: 700_000,
          dueDay: 5,
          categoryId: transactionId,
          active: state.status !== 'inactive',
          createdAt: new Date(0),
          updatedAt: new Date(0),
          deletedAt: null,
        },
        dueDate: '2026-09-05',
        leaf: {
          id: transactionId,
          name: 'Apartment',
          groupName: 'Rent',
          active: leafActive,
        },
        state,
      },
    ],
  };
}

test('resolves presentation data only for an eligible reserve payment', () => {
  expect(
    resolveReservePaymentIntent(
      overview({ status: 'unpaid', nextToAcceptPayment: true }),
      commitmentId
    )
  ).toEqual({
    status: 'ready',
    intent: {
      kind: 'reserve-payment',
      commitmentId,
      commitmentName: 'Rent',
      reservedAmount: 700_000,
      period: '2026-09',
      categoryId: transactionId,
      leafName: 'Apartment',
    },
  });
  expect(
    resolveReservePaymentIntent(overview({ status: 'inactive' }), commitmentId)
  ).toMatchObject({ status: 'unavailable' });
  expect(
    resolveReservePaymentIntent(
      overview({ status: 'paid', transactionId }),
      commitmentId
    )
  ).toMatchObject({ status: 'unavailable' });
  expect(
    resolveReservePaymentIntent(
      overview({ status: 'unpaid', nextToAcceptPayment: false }),
      commitmentId
    )
  ).toMatchObject({ status: 'unavailable' });
  expect(
    resolveReservePaymentIntent(
      overview({ status: 'unpaid', nextToAcceptPayment: true }, false),
      commitmentId
    )
  ).toMatchObject({ status: 'unavailable' });
  expect(
    resolveReservePaymentIntent(
      { ...overview({ status: 'unpaid', nextToAcceptPayment: true }), items: [] },
      commitmentId
    )
  ).toMatchObject({ status: 'unavailable' });
});

test('validates a UUID route parameter without accepting arrays', () => {
  expect(parseTransactionRoute(transactionId)).toEqual({
    status: 'valid',
    transactionId,
  });
  expect(parseTransactionRoute([transactionId])).toEqual({
    status: 'invalid',
    message: 'This transaction link is invalid.',
  });
  expect(parseTransactionRoute('not-a-uuid')).toEqual({
    status: 'invalid',
    message: 'This transaction link is invalid.',
  });
});

test('rejects invalid links before reading the public data API', async () => {
  const readTransaction = jest.fn();

  await expect(loadTransactionRoute('not-a-uuid', readTransaction)).resolves.toEqual({
    status: 'invalid',
    message: 'This transaction link is invalid.',
  });
  expect(readTransaction).not.toHaveBeenCalled();
});

test('loads a valid transaction by id and reports a missing row explicitly', async () => {
  const transaction: Transaction = {
    id: transactionId,
    accountId: '22222222-2222-4222-8222-222222222222',
    direction: 'expense',
    adjustmentEffect: null,
    amount: null,
    categoryId: null,
    quality: null,
    payer: { kind: 'you' },
    occurredAt: new Date(1735689600000),
    status: 'draft' as const,
    photoKey: null,
    note: null,
    sourceLabel: null,
    createdAt: new Date(1735689600000),
    updatedAt: new Date(1735689600000),
    deletedAt: null,
  };
  const readTransaction = jest
    .fn()
    .mockResolvedValueOnce(transaction)
    .mockResolvedValueOnce(undefined);

  await expect(loadTransactionRoute(transactionId, readTransaction)).resolves.toEqual({
    status: 'ready',
    transaction,
  });
  await expect(loadTransactionRoute(transactionId, readTransaction)).resolves.toEqual({
    status: 'unavailable',
    transactionId,
  });
  expect(readTransaction).toHaveBeenNthCalledWith(1, transactionId);
  expect(readTransaction).toHaveBeenNthCalledWith(2, transactionId);
});
