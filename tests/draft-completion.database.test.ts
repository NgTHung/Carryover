import { strict as assert } from 'node:assert';

import { createAsyncAtomicRunner } from '../src/data/atomic';
import { createCategoryData } from '../src/data/categories';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createManualTransactionData } from '../src/data/manual-transactions';
import { createTransactionData } from '../src/data/transactions';
import {
  createProxyDatabase,
  openMigratedDatabase,
} from './support/sqlite-proxy';

const now = new Date(2026, 8, 15, 12, 30);
const future = new Date(2026, 8, 16, 0, 1);
const photoKey = 'photos/v1/11111111-1111-4111-8111-111111111111.jpg';

type IdRow = { id: string };

function idFor(
  database: ReturnType<typeof openMigratedDatabase>,
  query: string,
  ...params: string[]
): string {
  const row = database.prepare(query).get(...params) as IdRow | undefined;
  if (row === undefined) throw new Error(`Missing id for ${query}`);
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

function createData(
  database: ReturnType<typeof openMigratedDatabase>,
  changes: string[] = []
) {
  const proxy = createProxyDatabase(database);
  const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
  notifier.subscribe(({ table, mutation }) => changes.push(`${table}:${mutation}`));
  const categoryData = createCategoryData(proxy, notifier);
  return {
    drafts: createTransactionData(proxy, categoryData, notifier),
    manual: createManualTransactionData(proxy, categoryData, notifier, {
      runAtomic: createAsyncAtomicRunner(proxy),
      now: () => now,
    }),
  };
}

test('completes an unknown expense in place and preserves captured fields', async () => {
  const database = openMigratedDatabase();
  try {
    const changes: string[] = [];
    const data = createData(database, changes);
    const draft = await data.drafts.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'draft',
      amount: null,
      categoryId: null,
      quality: null,
      photoKey,
      occurredAt: new Date(now.getTime()),
      note: null,
      sourceLabel: null,
    });
    const leafId = categoryId(database, 'Groceries');

    const completed = await data.manual.completeDraft({
      transactionId: draft.id,
      amount: '45001',
      categoryId: leafId,
    });

    assert.equal(completed.id, draft.id);
    assert.equal(completed.status, 'complete');
    assert.equal(completed.amount, 45_001);
    assert.equal(completed.categoryId, leafId);
    assert.equal(completed.accountId, draft.accountId);
    assert.equal(completed.occurredAt.getTime(), draft.occurredAt.getTime());
    assert.equal(completed.quality, null);
    assert.equal(completed.note, null);
    assert.equal(completed.photoKey, photoKey);
    assert.equal((await data.drafts.readTransaction(draft.id))?.status, 'complete');
    assert.deepEqual(changes, [
      'transactions:created',
      'month_config:created',
      'transactions:completed',
    ]);
  } finally {
    database.close();
  }
});

test('completes an income draft without a category and maintains current income once', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createData(database);
    const draft = await data.drafts.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'draft',
      amount: null,
      categoryId: null,
      photoKey,
      occurredAt: new Date(now.getTime()),
    });

    const completed = await data.manual.completeDraft({
      transactionId: draft.id,
      amount: 45_001,
      categoryId: null,
      changes: {
        direction: 'income',
        sourceLabel: '  Salary  ',
      },
    });

    assert.equal(completed.direction, 'income');
    assert.equal(completed.categoryId, null);
    assert.equal(completed.sourceLabel, 'Salary');
    assert.equal(completed.amount, 45_001);
    assert.equal(completed.photoKey, photoKey);
    assert.equal(
      (database
        .prepare("SELECT income_total AS incomeTotal FROM month_config WHERE period = '2026-09'")
        .get() as { incomeTotal: number }).incomeTotal,
      45_001
    );
  } finally {
    database.close();
  }
});

test('rejects invalid completion amounts without changing the draft or opening a period', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createData(database);
    const draft = await data.drafts.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'draft',
      amount: null,
      categoryId: null,
      photoKey,
      occurredAt: new Date(now.getTime()),
    });
    const leafId = categoryId(database, 'Groceries');
    const invalidAmounts: unknown[] = [
      0,
      -1,
      '12.5',
      '1e3',
      (BigInt(Number.MAX_SAFE_INTEGER) + 1n).toString(),
    ];

    for (const amount of invalidAmounts) {
      await assert.rejects(
        data.manual.completeDraft({
          transactionId: draft.id,
          amount,
          categoryId: leafId,
        })
      );
    }

    const unchanged = await data.drafts.readTransaction(draft.id);
    assert.equal(unchanged?.status, 'draft');
    assert.equal(unchanged?.amount, null);
    assert.equal(
      (database.prepare('SELECT COUNT(*) AS count FROM month_config').get() as { count: number }).count,
      0
    );
  } finally {
    database.close();
  }
});

test('rejects future dates before period preparation or promotion', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createData(database);
    const draft = await data.drafts.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'draft',
      amount: null,
      categoryId: null,
      photoKey,
      occurredAt: new Date(now.getTime()),
    });
    const leafId = categoryId(database, 'Groceries');

    await assert.rejects(
      data.manual.completeDraft({
        transactionId: draft.id,
        amount: 45_001,
        categoryId: leafId,
        changes: { occurredAt: future },
      }),
      /future/i
    );

    const unchanged = await data.drafts.readTransaction(draft.id);
    assert.equal(unchanged?.status, 'draft');
    assert.equal(unchanged?.amount, null);
    assert.equal(
      (database.prepare('SELECT COUNT(*) AS count FROM month_config').get() as { count: number }).count,
      0
    );
  } finally {
    database.close();
  }
});

test('rejects inactive accounts and non-leaf or inactive categories atomically', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createData(database);
    const leafId = categoryId(database, 'Groceries');
    const groupId = categoryId(database, 'Food');
    const missingId = '55555555-5555-4555-8555-555555555555';
    const account = bankId(database);
    const accountDraft = await data.drafts.createTransaction({
      accountId: account,
      direction: 'expense',
      status: 'draft',
      amount: null,
      categoryId: null,
      photoKey,
      occurredAt: new Date(now.getTime()),
    });
    database
      .prepare('UPDATE accounts SET deleted_at = ? WHERE id = ?')
      .run(now.getTime(), account);

    await assert.rejects(
      data.manual.completeDraft({
        transactionId: accountDraft.id,
        amount: 45_001,
        categoryId: leafId,
      }),
      /account/i
    );
    assert.equal((await data.drafts.readTransaction(accountDraft.id))?.status, 'draft');

    const categoryDatabase = openMigratedDatabase();
    try {
      const categoryData = createData(categoryDatabase);
      const categoryDraft = await categoryData.drafts.createTransaction({
        accountId: bankId(categoryDatabase),
        direction: 'expense',
        status: 'draft',
        amount: null,
        categoryId: null,
        photoKey,
        occurredAt: new Date(now.getTime()),
      });
      const activeLeaf = categoryId(categoryDatabase, 'Groceries');
      const activeGroup = categoryId(categoryDatabase, 'Food');
      await assert.rejects(
        categoryData.manual.completeDraft({
          transactionId: categoryDraft.id,
          amount: 45_001,
          categoryId: activeGroup,
        }),
        /category leaf/i
      );
      await assert.rejects(
        categoryData.manual.completeDraft({
          transactionId: categoryDraft.id,
          amount: 45_001,
          categoryId: missingId,
        }),
        /category leaf/i
      );
      categoryDatabase
        .prepare('UPDATE categories SET deleted_at = ? WHERE id = ?')
        .run(now.getTime(), activeLeaf);
      await assert.rejects(
        categoryData.manual.completeDraft({
          transactionId: categoryDraft.id,
          amount: 45_001,
          categoryId: activeLeaf,
        }),
        /category leaf/i
      );
      assert.equal((await categoryData.drafts.readTransaction(categoryDraft.id))?.status, 'draft');
    } finally {
      categoryDatabase.close();
    }
  } finally {
    database.close();
  }
});
