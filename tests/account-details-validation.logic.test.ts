import { strict as assert } from 'node:assert';

import { MAX_VND_AMOUNT } from '../src/money/currency';
import { editAccountDetailsSchema } from '../src/data/account-validation';

const bankId = '11111111-1111-4111-8111-111111111111';

test('account details validation trims names and accepts zero or the safe maximum', () => {
  assert.deepEqual(
    editAccountDetailsSchema.parse({
      accountId: bankId,
      name: '  Main bank  ',
      openingBalance: 0,
    }),
    { accountId: bankId, name: 'Main bank', openingBalance: 0 }
  );
  assert.equal(
    editAccountDetailsSchema.parse({
      accountId: bankId,
      name: 'Ngân hàng 💳',
      openingBalance: MAX_VND_AMOUNT,
    }).openingBalance,
    MAX_VND_AMOUNT
  );
});

test('account details validation rejects blank, malformed, unsafe, or extra input', () => {
  for (const name of ['', '   ']) {
    assert.throws(() =>
      editAccountDetailsSchema.parse({
        accountId: bankId,
        name,
        openingBalance: 1_000,
      })
    );
  }

  for (const openingBalance of [
    -1,
    12.5,
    MAX_VND_AMOUNT + 1,
    '1000',
    '1e3',
    '1,000',
    '',
  ]) {
    assert.throws(() =>
      editAccountDetailsSchema.parse({
        accountId: bankId,
        name: 'Bank',
        openingBalance,
      })
    );
  }

  assert.throws(() =>
    editAccountDetailsSchema.parse({
      accountId: bankId,
      name: 'Bank',
      openingBalance: 1_000,
      kind: 'bank',
    })
  );
  assert.throws(() =>
    editAccountDetailsSchema.parse({
      accountId: bankId,
      name: 'Bank',
      openingBalance: 1_000,
      updatedAt: new Date(),
    })
  );
});
