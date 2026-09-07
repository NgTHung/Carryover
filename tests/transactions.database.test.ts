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

test('invalid create amounts do not add a row', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const data = createTransactionData(proxy, createCategoryData(proxy));
    const before = (database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count;

    for (const amount of [0, -1, 12.5, (BigInt(Number.MAX_SAFE_INTEGER) + 1n).toString()]) {
      await assert.rejects(
        data.createTransaction({
          accountId: bankId(database),
          direction: 'expense',
          status: 'draft',
          amount,
          occurredAt,
        })
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
    await data.softDeleteTransaction(draft.id);

    assert.equal(await data.readTransaction(draft.id), undefined);
    assert.equal((await data.readTransactions()).length, 0);
    assert.equal((await data.readTransaction(draft.id, { includeDeleted: true }))?.id, draft.id);
    await assert.rejects(data.softDeleteTransaction(draft.id), /not found/i);
  } finally {
    database.close();
  }
});

test('edit validates the resulting transaction before writing', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const data = createTransactionData(proxy, createCategoryData(proxy));
    const leafId = categoryId(database, 'Groceries');
    const groupId = categoryId(database, 'Food');
    const draft = await data.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'draft',
      occurredAt,
    });

    const edited = await data.editTransaction({
      transactionId: draft.id,
      changes: { amount: '45000', categoryId: leafId },
    });
    assert.equal(edited.amount, 45_000);
    assert.equal(edited.categoryId, leafId);

    await assert.rejects(
      data.editTransaction({
        transactionId: draft.id,
        changes: { categoryId: groupId },
      }),
      /category leaf/i
    );
    await assert.rejects(
      data.editTransaction({
        transactionId: draft.id,
        changes: { amount: 0 },
      })
    );

    const unchanged = await data.readTransaction(draft.id);
    assert.equal(unchanged?.amount, 45_000);
    assert.equal(unchanged?.categoryId, leafId);

    const blankDraft = await data.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'draft',
      amount: 50_000,
      occurredAt,
    });
    const blanked = await data.editTransaction({
      transactionId: blankDraft.id,
      changes: { amount: '   ' },
    });
    assert.equal(blanked.amount, null);
  } finally {
    database.close();
  }
});

test('completeDraft promotes only drafts and leaves rejected rows unchanged', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const data = createTransactionData(proxy, createCategoryData(proxy));
    const leafId = categoryId(database, 'Groceries');
    const draft = await data.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'draft',
      occurredAt,
    });

    const complete = await data.completeDraft({
      transactionId: draft.id,
      amount: '45000',
      categoryId: leafId,
    });
    assert.equal(complete.status, 'complete');
    assert.equal(complete.amount, 45_000);
    assert.equal(complete.categoryId, leafId);

    await assert.rejects(
      data.completeDraft({
        transactionId: complete.id,
        amount: 50_000,
        categoryId: leafId,
      }),
      /already complete/i
    );

    const incomplete = await data.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'draft',
      occurredAt,
    });
    const groupId = categoryId(database, 'Food');
    await assert.rejects(
      data.completeDraft({
        transactionId: incomplete.id,
        amount: 50_000,
        categoryId: groupId,
      }),
      /category leaf/i
    );
    await assert.rejects(
      data.completeDraft({
        transactionId: incomplete.id,
        amount: (BigInt(Number.MAX_SAFE_INTEGER) + 1n).toString(),
        categoryId: leafId,
      })
    );
    const unchanged = await data.readTransaction(incomplete.id);
    assert.equal(unchanged?.status, 'draft');
    assert.equal(unchanged?.amount, null);
  } finally {
    database.close();
  }
});

test('overlapping edits reject the stale write without restoring older fields', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const data = createTransactionData(proxy, createCategoryData(proxy));
    const leafId = categoryId(database, 'Groceries');
    const draft = await data.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'draft',
      amount: 45_000,
      categoryId: leafId,
      occurredAt,
    });

    const results = await Promise.allSettled([
      data.editTransaction({
        transactionId: draft.id,
        changes: { amount: 50_000 },
      }),
      data.editTransaction({
        transactionId: draft.id,
        changes: { note: 'Changed concurrently' },
      }),
    ]);

    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    const rejected = results.find((result) => result.status === 'rejected');
    assert.equal(rejected?.status, 'rejected');
    if (rejected?.status === 'rejected') {
      assert.match(String(rejected.reason), /changed during update/i);
    }

    const stored = await data.readTransaction(draft.id);
    if (results[0]?.status === 'fulfilled') {
      assert.equal(stored?.amount, 50_000);
      assert.equal(stored?.note, null);
    } else {
      assert.equal(stored?.amount, 45_000);
      assert.equal(stored?.note, 'Changed concurrently');
    }
  } finally {
    database.close();
  }
});

test('an edit overlapping completion cannot restore draft status', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const data = createTransactionData(proxy, createCategoryData(proxy));
    const leafId = categoryId(database, 'Groceries');
    const draft = await data.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'draft',
      categoryId: leafId,
      occurredAt,
    });

    const results = await Promise.allSettled([
      data.completeDraft({
        transactionId: draft.id,
        amount: 60_000,
      }),
      data.editTransaction({
        transactionId: draft.id,
        changes: { note: 'Changed concurrently' },
      }),
    ]);

    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    const rejected = results.find((result) => result.status === 'rejected');
    assert.equal(rejected?.status, 'rejected');
    if (rejected?.status === 'rejected') {
      assert.match(String(rejected.reason), /changed during update/i);
    }

    const stored = await data.readTransaction(draft.id);
    if (results[0]?.status === 'fulfilled') {
      assert.equal(stored?.status, 'complete');
      assert.equal(stored?.amount, 60_000);
      assert.equal(stored?.note, null);
    } else {
      assert.equal(stored?.status, 'draft');
      assert.equal(stored?.amount, null);
      assert.equal(stored?.note, 'Changed concurrently');
    }
  } finally {
    database.close();
  }
});

test('editing another field preserves a deleted historical category', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const categories = createCategoryData(proxy);
    const data = createTransactionData(proxy, categories);
    const leafId = categoryId(database, 'Groceries');
    const transaction = await data.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'complete',
      amount: 45_000,
      categoryId: leafId,
      occurredAt,
    });
    await categories.softDeleteLeaf(leafId);

    const edited = await data.editTransaction({
      transactionId: transaction.id,
      changes: { note: 'Corrected after category deletion' },
    });

    assert.equal(edited.categoryId, leafId);
    assert.equal(edited.note, 'Corrected after category deletion');
  } finally {
    database.close();
  }
});
