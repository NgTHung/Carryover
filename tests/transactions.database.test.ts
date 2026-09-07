import { strict as assert } from 'node:assert';

import { createCategoryData } from '../src/data/categories';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';
import { createTransactionData } from '../src/data/transactions';

type IdRow = { id: unknown };

const occurredAt = new Date(1735689600000);

function idFor(
  database: ReturnType<typeof openMigratedDatabase>,
  query: string,
  ...params: string[]
): string {
  const row = database.prepare(query).get(...params) as IdRow | undefined;
  if (!row || typeof row.id !== 'string') {
    throw new Error(`Expected an id for ${query}`);
  }
  return row.id;
}

function bankId(database: ReturnType<typeof openMigratedDatabase>): string {
  return idFor(
    database,
    "SELECT id FROM accounts WHERE name = 'Bank' AND deleted_at IS NULL"
  );
}

function categoryId(
  database: ReturnType<typeof openMigratedDatabase>,
  name: string
): string {
  return idFor(
    database,
    'SELECT id FROM categories WHERE name = ? AND deleted_at IS NULL',
    name
  );
}

test('create and read preserve unknown drafts and interpret a null payer as you', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const data = createTransactionData(proxy, createCategoryData(proxy));

    const draft = await data.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'draft',
      amount: '   ',
      occurredAt,
      note: 'Captured at lunch',
    });

    assert.equal(draft.status, 'draft');
    assert.equal(draft.amount, null);
    assert.deepEqual(draft.payer, { kind: 'you' });
    assert.equal(draft.note, 'Captured at lunch');
    assert.deepEqual(await data.readTransaction(draft.id), draft);
    assert.equal(
      (database.prepare('SELECT amount FROM transactions WHERE id = ?').get(draft.id) as { amount: unknown }).amount,
      null
    );
  } finally {
    database.close();
  }
});

test('complete expense and income writes round-trip categories, payer, and source label', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const data = createTransactionData(proxy, createCategoryData(proxy));
    const leafId = categoryId(database, 'Groceries');
    const contactId = idFor(
      database,
      "INSERT INTO contacts (name) VALUES ('Lan') RETURNING id"
    );

    const expense = await data.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'complete',
      amount: 45_000,
      categoryId: leafId,
      payer: { kind: 'contact', contactId },
      occurredAt,
    });
    assert.equal(expense.status, 'complete');
    assert.equal(expense.amount, 45_000);
    assert.equal(expense.categoryId, leafId);
    assert.deepEqual(expense.payer, { kind: 'contact', contactId });

    const income = await data.createTransaction({
      accountId: bankId(database),
      direction: 'income',
      status: 'complete',
      amount: '1250000',
      sourceLabel: 'Salary',
      occurredAt,
    });
    assert.equal(income.categoryId, null);
    assert.equal(income.sourceLabel, 'Salary');
    assert.equal(income.amount, 1_250_000);
  } finally {
    database.close();
  }
});

test('category writes reject missing, deleted, and group IDs before changing the ledger', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const data = createTransactionData(proxy, createCategoryData(proxy));
    const groupId = categoryId(database, 'Food');
    const deletedLeafId = categoryId(database, 'Groceries');
    database
      .prepare('UPDATE categories SET deleted_at = ? WHERE id = ?')
      .run(occurredAt.getTime(), deletedLeafId);
    const before = (database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count;

    for (const invalidCategoryId of [
      groupId,
      deletedLeafId,
      '44444444-4444-4444-8444-444444444444',
    ]) {
      await assert.rejects(
        data.createTransaction({
          accountId: bankId(database),
          direction: 'expense',
          status: 'complete',
          amount: 45_000,
          categoryId: invalidCategoryId,
          occurredAt,
        }),
        /category leaf/i
      );
    }

    const after = (database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count;
    assert.equal(after, before);
  } finally {
    database.close();
  }
});

test('normal transaction reads hide a soft-deleted row', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const data = createTransactionData(proxy, createCategoryData(proxy));
    const draft = await data.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'draft',
      occurredAt,
    });
    database
      .prepare('UPDATE transactions SET deleted_at = ? WHERE id = ?')
      .run(occurredAt.getTime(), draft.id);

    assert.equal(await data.readTransaction(draft.id), undefined);
    assert.equal((await data.readTransactions()).length, 0);
    assert.equal((await data.readTransaction(draft.id, { includeDeleted: true }))?.id, draft.id);
  } finally {
    database.close();
  }
});
