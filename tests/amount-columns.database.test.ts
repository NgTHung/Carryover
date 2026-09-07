import { strict as assert } from 'node:assert';

import { accounts, transactions } from '../src/data/schema';
import { MAX_VND_AMOUNT } from '../src/money/currency';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

test('ORM money adapters validate and round-trip positive and nonnegative amounts', async () => {
  const sqlite = openMigratedDatabase();
  try {
    const database = createProxyDatabase(sqlite);
    const accountRows = await database
      .insert(accounts)
      .values({
        name: 'ORM bank',
        kind: 'bank',
        openingBalance: MAX_VND_AMOUNT,
      })
      .returning();
    const account = accountRows[0];
    if (!account) {
      throw new Error('Expected the ORM account insert to return a row');
    }
    assert.equal(account.openingBalance, MAX_VND_AMOUNT);

    const transactionRows = await database
      .insert(transactions)
      .values({
        accountId: account.id,
        direction: 'expense',
        amount: 45000,
        occurredAt: new Date(1735689600000),
        status: 'complete',
      })
      .returning();
    const transaction = transactionRows[0];
    if (!transaction) {
      throw new Error('Expected the ORM transaction insert to return a row');
    }
    assert.equal(transaction.amount, 45000);

    await assert.rejects(
      async () => {
        await database
          .insert(accounts)
          .values({ name: 'Fractional', kind: 'cash', openingBalance: 12.5 })
          .returning();
      },
      /integer|VND|number/i
    );
    await assert.rejects(
      async () => {
        await database
          .insert(transactions)
          .values({
            accountId: account.id,
            direction: 'expense',
            amount: MAX_VND_AMOUNT + 1,
            occurredAt: new Date(1735689600000),
            status: 'draft',
          })
          .returning();
      },
      /less than or equal|safe|number|VND/i
    );
  } finally {
    sqlite.close();
  }
});
