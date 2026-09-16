import { strict as assert } from 'node:assert';

import { createCategoryData } from '../src/data/categories';
import { createDraftInboxData } from '../src/data/draft-inbox';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';
import { createTransactionData } from '../src/data/transactions';

const firstCreatedAt = new Date(2026, 7, 1, 8, 0);
const tiedCreatedAt = new Date(2026, 7, 2, 8, 0);
const firstOccurredAt = new Date(2025, 11, 31, 22, 30);
const secondOccurredAt = new Date(2026, 8, 15, 9, 0);
const thirdOccurredAt = new Date(2026, 8, 16, 9, 0);
const photoKey = 'photos/v1/11111111-1111-4111-8111-111111111111.jpg';

function idFor(
  database: ReturnType<typeof openMigratedDatabase>,
  query: string,
  ...params: string[]
): string {
  const row = database.prepare(query).get(...params) as { id: string } | undefined;
  if (row === undefined) throw new Error(`Missing id for ${query}`);
  return row.id;
}

test('reads active drafts across periods, preserves nulls, and orders captures', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const categories = createCategoryData(proxy);
    const transactions = createTransactionData(proxy, categories);
    const inbox = createDraftInboxData(proxy);
    const bankId = idFor(database, "SELECT id FROM accounts WHERE name = 'Bank'");
    const groceriesId = idFor(
      database,
      "SELECT id FROM categories WHERE name = 'Groceries' AND deleted_at IS NULL"
    );

    const older = await transactions.createTransaction({
      accountId: bankId,
      direction: 'expense',
      status: 'draft',
      amount: '45001',
      categoryId: groceriesId,
      photoKey,
      note: 'Older capture',
      occurredAt: firstOccurredAt,
    });
    const tiedUnknown = await transactions.createTransaction({
      accountId: bankId,
      direction: 'expense',
      status: 'draft',
      amount: ' ',
      photoKey: null,
      occurredAt: secondOccurredAt,
    });
    const tiedIncome = await transactions.createTransaction({
      accountId: bankId,
      direction: 'income',
      status: 'draft',
      amount: 12_000,
      photoKey,
      sourceLabel: 'Cashback',
      occurredAt: thirdOccurredAt,
    });
    const complete = await transactions.createTransaction({
      accountId: bankId,
      direction: 'income',
      status: 'complete',
      amount: 99_000,
      occurredAt: secondOccurredAt,
    });
    const deleted = await transactions.createTransaction({
      accountId: bankId,
      direction: 'expense',
      status: 'draft',
      amount: '45002',
      occurredAt: secondOccurredAt,
    });

    database
      .prepare('UPDATE transactions SET created_at = ? WHERE id = ?')
      .run(firstCreatedAt.getTime(), older.id);
    database
      .prepare('UPDATE transactions SET created_at = ? WHERE id IN (?, ?)')
      .run(tiedCreatedAt.getTime(), tiedUnknown.id, tiedIncome.id);
    await transactions.softDeleteTransaction(deleted.id);

    database
      .prepare('UPDATE accounts SET deleted_at = ? WHERE id = ?')
      .run(secondOccurredAt.getTime(), bankId);
    database
      .prepare('UPDATE categories SET deleted_at = ? WHERE id = ?')
      .run(secondOccurredAt.getTime(), groceriesId);

    const drafts = await inbox.readActiveDrafts();
    const tiedIds = [tiedUnknown.id, tiedIncome.id].sort((left, right) =>
      left.localeCompare(right)
    );

    assert.equal(drafts.map((draft) => draft.id).join(','), [older.id, ...tiedIds].join(','));
    assert.equal(drafts[0]?.amount, 45_001);
    assert.equal(drafts[0]?.photoKey, photoKey);
    assert.equal(drafts[0]?.categoryId, groceriesId);
    assert.equal(drafts[0]?.occurredAt.getTime(), firstOccurredAt.getTime());
    const unknown = drafts.find((draft) => draft.id === tiedUnknown.id);
    const income = drafts.find((draft) => draft.id === tiedIncome.id);
    assert.equal(unknown?.amount, null);
    assert.equal(unknown?.photoKey, null);
    assert.equal(unknown?.occurredAt.getTime(), secondOccurredAt.getTime());
    assert.equal(income?.direction, 'income');
    assert.equal(income?.amount, 12_000);
    assert.equal(income?.sourceLabel, 'Cashback');
    assert.equal(income?.status, 'draft');
    assert.equal(drafts.some((draft) => draft.id === complete.id), false);
    assert.equal(drafts.some((draft) => draft.id === deleted.id), false);
  } finally {
    database.close();
  }
});

test('the public draft read is active-only and performs no write or photo work', async () => {
  const database = openMigratedDatabase();
  try {
    const queries: string[] = [];
    const proxy = createProxyDatabase(database, {
      afterQuery: (query) => {
        queries.push(query);
      },
    });
    const inbox = createDraftInboxData(proxy);

    await inbox.readActiveDrafts();

    assert.equal(queries.length, 1);
    assert.match(queries[0] ?? '', /select/i);
    assert.doesNotMatch(queries[0] ?? '', /\b(insert|update|delete)\b|accounts|categories/i);
  } finally {
    database.close();
  }
});
