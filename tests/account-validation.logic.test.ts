import { strict as assert } from 'node:assert';

import { MAX_VND_AMOUNT } from '../src/money/currency';
import {
  recordTransferSchema,
  updateAccountOpeningBalanceSchema,
} from '../src/data/account-validation';

const bankId = '11111111-1111-4111-8111-111111111111';
const cashId = '22222222-2222-4222-8222-222222222222';

test('account opening balance validation accepts zero and the safe maximum', () => {
  assert.equal(
    updateAccountOpeningBalanceSchema.parse({
      accountId: bankId,
      openingBalance: 0,
    }).openingBalance,
    0
  );
  assert.equal(
    updateAccountOpeningBalanceSchema.parse({
      accountId: bankId,
      openingBalance: MAX_VND_AMOUNT,
    }).openingBalance,
    MAX_VND_AMOUNT
  );
});

test('account opening balance validation rejects invalid money and fields', () => {
  for (const openingBalance of [-1, 12.5, MAX_VND_AMOUNT + 1, '1000']) {
    assert.throws(() =>
      updateAccountOpeningBalanceSchema.parse({ accountId: bankId, openingBalance })
    );
  }
  assert.throws(() =>
    updateAccountOpeningBalanceSchema.parse({
      accountId: 'not-an-id',
      openingBalance: 1000,
    })
  );
  assert.throws(() =>
    updateAccountOpeningBalanceSchema.parse({
      accountId: bankId,
      openingBalance: 1000,
      extra: true,
    })
  );
});

test('transfer validation requires positive money, distinct accounts, and a date', () => {
  const input = {
    fromAccountId: bankId,
    toAccountId: cashId,
    amount: 125000,
    occurredAt: new Date(1735689600000),
  };
  assert.equal(recordTransferSchema.parse(input).amount, 125000);

  for (const amount of [0, -1, 12.5, MAX_VND_AMOUNT + 1, '125000']) {
    assert.throws(() => recordTransferSchema.parse({ ...input, amount }));
  }
  assert.throws(() =>
    recordTransferSchema.parse({ ...input, toAccountId: bankId })
  );
  assert.throws(() =>
    recordTransferSchema.parse({ ...input, occurredAt: '2025-01-01' })
  );
});
