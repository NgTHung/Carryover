import { loadTransactionRoute, parseTransactionRoute } from '../src/screens/transactions/load-transaction-route';
import type { Transaction } from '../src/data/transaction-validation';

const transactionId = '11111111-1111-4111-8111-111111111111';

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
