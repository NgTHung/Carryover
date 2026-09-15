import { strict as assert } from 'node:assert';

import {
  loadTransferRoute,
  parseTransferRoute,
} from '../src/ui/transfers/transfer-route';
import type { TransferRead } from '../src/data/transfer-reads';

const transferId = '11111111-1111-4111-8111-111111111111';
const date = new Date(2026, 8, 15, 12);

const transfer: TransferRead = {
  transfer: { id: transferId, amount: 200_000, occurredAt: date, createdAt: date },
  fromAccount: { id: '22222222-2222-4222-8222-222222222222', name: 'Bank', kind: 'bank' },
  toAccount: { id: '33333333-3333-4333-8333-333333333333', name: 'Cash', kind: 'cash' },
};

test('accepts one scalar UUID and rejects missing, repeated, and malformed links', () => {
  assert.deepEqual(parseTransferRoute(transferId), { status: 'valid', transferId });
  assert.equal(parseTransferRoute(undefined).status, 'invalid');
  assert.equal(parseTransferRoute([transferId]).status, 'invalid');
  assert.equal(parseTransferRoute([transferId, transferId]).status, 'invalid');
  assert.equal(parseTransferRoute('not-a-uuid').status, 'invalid');
});

test('does not read invalid links and reports missing rows explicitly', async () => {
  const readTransfer = jest.fn<Promise<TransferRead | undefined>, [string]>();
  await expect(loadTransferRoute('not-a-uuid', readTransfer)).resolves.toEqual({
    status: 'invalid',
    message: 'This transfer link is invalid.',
  });
  expect(readTransfer).not.toHaveBeenCalled();

  readTransfer.mockResolvedValueOnce(transfer).mockResolvedValueOnce(undefined);
  await expect(loadTransferRoute(transferId, readTransfer)).resolves.toEqual({
    status: 'ready',
    transfer,
  });
  await expect(loadTransferRoute(transferId, readTransfer)).resolves.toEqual({
    status: 'unavailable',
    transferId,
  });
});

test('propagates public read failures for a retryable route state', async () => {
  const readTransfer = jest.fn<Promise<TransferRead | undefined>, [string]>(async () => {
    throw new Error('read unavailable');
  });
  await expect(loadTransferRoute(transferId, readTransfer)).rejects.toThrow('read unavailable');
});
