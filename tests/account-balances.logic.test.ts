import { strict as assert } from 'node:assert';

import { deriveAccountBalances } from '../src/data/account-balances';

const bankId = '11111111-1111-4111-8111-111111111111';
const cashId = '22222222-2222-4222-8222-222222222222';

test('account balances derive opening balance, transactions, and transfers', () => {
  const balances = deriveAccountBalances({
    accounts: [
      { accountId: bankId, openingBalance: 1_000_000 },
      { accountId: cashId, openingBalance: 100_000 },
    ],
    transactions: [
      {
        accountId: bankId,
        direction: 'expense',
        amount: 250_000,
        payerContactId: null,
      },
      {
        accountId: bankId,
        direction: 'expense',
        amount: 600_000,
        payerContactId: '33333333-3333-4333-8333-333333333333',
      },
      { accountId: bankId, direction: 'income', amount: 50_000 },
      {
        accountId: cashId,
        direction: 'expense',
        amount: null,
        payerContactId: null,
      },
      { accountId: bankId, direction: 'transfer', amount: 500_000 },
    ],
    transfers: [
      { fromAccountId: bankId, toAccountId: cashId, amount: 300_000 },
    ],
  });

  assert.equal(balances[0]?.accountId, bankId);
  assert.equal(balances[0]?.balance, 500_000);
  assert.equal(balances[1]?.accountId, cashId);
  assert.equal(balances[1]?.balance, 400_000);
});

test('transfer arithmetic preserves the combined balance and allows overdraft balances', () => {
  const balances = deriveAccountBalances({
    accounts: [
      { accountId: bankId, openingBalance: 100 },
      { accountId: cashId, openingBalance: 0 },
    ],
    transactions: [
      {
        accountId: bankId,
        direction: 'expense',
        amount: 150,
        payerContactId: null,
      },
    ],
    transfers: [
      { fromAccountId: bankId, toAccountId: cashId, amount: 25 },
    ],
  });

  assert.equal(balances[0]?.balance, -75);
  assert.equal(balances[1]?.balance, 25);
  assert.equal(
    (balances[0]?.balance ?? 0) + (balances[1]?.balance ?? 0),
    -50
  );
});

test('balance derivation rejects adjustments, unknown accounts, and unsafe results', () => {
  assert.throws(() =>
    deriveAccountBalances({
      accounts: [{ accountId: bankId, openingBalance: 0 }],
      transactions: [{ accountId: bankId, direction: 'adjustment', amount: 1 }],
      transfers: [],
    })
  );
  assert.throws(() =>
    deriveAccountBalances({
      accounts: [{ accountId: bankId, openingBalance: 0 }],
      transactions: [{ accountId: cashId, direction: 'income', amount: 1 }],
      transfers: [],
    })
  );
  assert.throws(() =>
    deriveAccountBalances({
      accounts: [{ accountId: bankId, openingBalance: Number.MAX_SAFE_INTEGER }],
      transactions: [{ accountId: bankId, direction: 'income', amount: 1 }],
      transfers: [],
    })
  );
});
