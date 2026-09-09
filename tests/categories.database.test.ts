import { strict as assert } from 'node:assert';

import { createCategoryData } from '../src/data/categories';
import { createLedgerReads } from '../src/data/ledger-reads';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

type IdRow = { id: unknown };
type ActiveCategoryRow = {
  id: unknown;
  name: unknown;
  parentId: unknown;
  isSuggestion: unknown;
  deletedAt: unknown;
};

function categoryId(
  database: ReturnType<typeof openMigratedDatabase>,
  name: string
): string {
  const row = database
    .prepare('SELECT id FROM categories WHERE name = ? AND deleted_at IS NULL')
    .get(name) as IdRow | undefined;
  if (!row || typeof row.id !== 'string') {
    throw new Error(`Missing active category ${name}`);
  }
  return row.id;
}

function bankId(database: ReturnType<typeof openMigratedDatabase>): string {
  const row = database
    .prepare("SELECT id FROM accounts WHERE name = 'Bank' AND deleted_at IS NULL")
    .get() as IdRow | undefined;
  if (!row || typeof row.id !== 'string') {
    throw new Error('Missing bank account');
  }
  return row.id;
}

test('category creation returns typed groups and leaves', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createCategoryData(createProxyDatabase(database));
    const group = await data.createCategory({
      level: 'group',
      name: 'Weekend',
      sort: 20,
      kind: 'spend',
    });
    assert.equal(group.level, 'group');

    const leaf = await data.createCategory({
      level: 'leaf',
      name: 'Cinema',
      sort: 0,
      groupId: group.id,
    });
    assert.equal(leaf.level, 'leaf');
    if (leaf.level !== 'leaf') {
      throw new Error('Expected a leaf');
    }
    assert.equal(leaf.group.id, group.id);
    assert.equal(leaf.group.level, 'group');
    assert.equal(leaf.kind, group.kind);
    assert.equal(leaf.isSuggestion, false);
  } finally {
    database.close();
  }
});

test('category creation appends, lists, renames, and changes group kind', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createCategoryData(createProxyDatabase(database));
    const group = await data.createCategory({
      level: 'group',
      name: 'Weekend',
      kind: 'spend',
    });
    const leaf = await data.createCategory({
      level: 'leaf',
      name: 'Cinema',
      groupId: group.id,
    });

    assert.equal(group.sort, 8);
    assert.equal(leaf.sort, 0);
    await data.renameCategory({ categoryId: group.id, name: 'Leisure' });
    await data.setCategoryGroupKind({ groupId: group.id, kind: 'reserve' });

    const sections = await data.listActiveCategoryGroups();
    const leisure = sections.find((section) => section.id === group.id);
    assert.equal(leisure?.name, 'Leisure');
    assert.equal(leisure?.kind, 'reserve');
    assert.equal(leisure?.leaves[0]?.name, 'Cinema');
    assert.equal(leisure?.leaves[0]?.kind, 'reserve');
  } finally {
    database.close();
  }
});

test('category reordering assigns deterministic sibling sort values', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createCategoryData(createProxyDatabase(database));
    const groups = await data.listActiveCategoryGroups();
    const reversedGroups = groups.map((group) => group.id).reverse();
    await data.reorderCategories({ level: 'group', categoryIds: reversedGroups });

    const reordered = await data.listActiveCategoryGroups();
    assert.deepEqual(
      reordered.map((group) => group.id),
      reversedGroups
    );
    assert.deepEqual(
      reordered.map((group) => group.sort),
      reversedGroups.map((_, index) => index)
    );

    const food = reordered.find((group) => group.name === 'Food');
    if (!food) throw new Error('Missing Food group');
    const reversedLeaves = food.leaves.map((leaf) => leaf.id).reverse();
    await data.reorderCategories({
      level: 'leaf',
      groupId: food.id,
      categoryIds: reversedLeaves,
    });
    const reorderedFood = (await data.listActiveCategoryGroups()).find(
      (group) => group.id === food.id
    );
    assert.deepEqual(
      reorderedFood?.leaves.map((leaf) => leaf.id),
      reversedLeaves
    );

    await assert.rejects(
      data.reorderCategories({
        level: 'leaf',
        groupId: food.leaves[0]?.id,
        categoryIds: reversedLeaves,
      }),
      /category order/i
    );
  } finally {
    database.close();
  }
});

test('deleting a group soft-deletes its leaves and keeps history readable', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const data = createCategoryData(proxy);
    const reads = createLedgerReads(proxy);
    const foodId = categoryId(database, 'Food');
    const leafId = categoryId(database, 'Groceries');
    database
      .prepare(
        "INSERT INTO transactions (account_id, direction, amount, category_id, occurred_at, status) VALUES (?, 'expense', 45000, ?, 1735689600000, 'complete')"
      )
      .run(bankId(database), leafId);

    await data.softDeleteCategory(foodId);

    await assert.rejects(data.requireActiveLeafCategory(leafId), /category leaf/i);
    const reference = await data.readLeafReference(leafId);
    assert.equal(reference?.group.id, foodId);
    assert.ok(reference?.group);
    assert.ok(reference?.group.name === 'Food');
    assert.ok(reference?.deletedAt instanceof Date);
    assert.equal((await reads.categories().all()).some((row) => row.id === foodId), false);
    assert.equal((await reads.transactions().get())?.categoryId, leafId);
  } finally {
    database.close();
  }
});

test('leaf creation rejects missing, deleted, and leaf group references before writing', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createCategoryData(createProxyDatabase(database));
    const groupId = categoryId(database, 'Food');
    const leafId = categoryId(database, 'Groceries');
    const before = database
      .prepare('SELECT COUNT(*) AS count FROM categories')
      .get() as { count: number };

    await assert.rejects(
      data.createCategory({
        level: 'leaf',
        name: 'Missing group',
        sort: 0,
        groupId: '33333333-3333-4333-8333-333333333333',
      }),
      /category group/i
    );
    await assert.rejects(
      data.createCategory({ level: 'leaf', name: 'Nested', sort: 0, groupId: leafId }),
      /category group/i
    );

    database
      .prepare('UPDATE categories SET deleted_at = ? WHERE id = ?')
      .run(1735689600000, groupId);
    await assert.rejects(
      data.createCategory({ level: 'leaf', name: 'Deleted group', sort: 0, groupId: groupId }),
      /category group/i
    );

    const after = database
      .prepare('SELECT COUNT(*) AS count FROM categories')
      .get() as { count: number };
    assert.equal(after.count, before.count);
  } finally {
    database.close();
  }
});

test('the shared active-leaf validator rejects groups and deleted leaves', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createCategoryData(createProxyDatabase(database));
    const groupId = categoryId(database, 'Food');
    const leafId = categoryId(database, 'Groceries');
    const activeLeaf = await data.requireActiveLeafCategory(leafId);
    assert.equal(activeLeaf.level, 'leaf');
    assert.equal(activeLeaf.group.id, groupId);

    await assert.rejects(data.requireActiveLeafCategory(groupId), /category leaf/i);
    await assert.rejects(
      data.requireActiveLeafCategory('33333333-3333-4333-8333-333333333333'),
      /category leaf/i
    );

    await data.softDeleteLeaf(leafId);
    await assert.rejects(data.requireActiveLeafCategory(leafId), /category leaf/i);
  } finally {
    database.close();
  }
});

test('soft-deleting a referenced leaf preserves the transaction category reference', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const data = createCategoryData(proxy);
    const reads = createLedgerReads(proxy);
    const leafId = categoryId(database, 'Groceries');
    database
      .prepare(
        "INSERT INTO transactions (account_id, direction, amount, category_id, occurred_at, status) VALUES (?, 'expense', 45000, ?, 1735689600000, 'complete')"
      )
      .run(bankId(database), leafId);

    await data.softDeleteLeaf(leafId);

    const transaction = await reads.transactions().get();
    assert.equal(transaction?.categoryId, leafId);
    const reference = await data.readLeafReference(leafId);
    assert.equal(reference?.level, 'leaf');
    assert.equal(reference?.name, 'Groceries');
    assert.equal(reference?.group.name, 'Food');
    assert.ok(reference?.deletedAt instanceof Date);
  } finally {
    database.close();
  }
});

test('bulk suggestion deletion retains a group adopted by a user leaf', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const data = createCategoryData(proxy);
    const reads = createLedgerReads(proxy);
    const foodId = categoryId(database, 'Food');
    const customLeaf = await data.createCategory({
      level: 'leaf',
      name: 'Bakery',
      sort: 10,
      groupId: foodId,
    });

    await data.deleteSuggestedCategories();

    const activeRows = (await reads.categories().all()) as ActiveCategoryRow[];
    const food = activeRows.find((row) => row.id === foodId);
    const bakery = activeRows.find((row) => row.id === customLeaf.id);
    assert.equal(food?.name, 'Food');
    assert.equal(food?.isSuggestion, false);
    assert.equal(food?.deletedAt, null);
    assert.equal(bakery?.name, 'Bakery');
    assert.equal(bakery?.parentId, foodId);
    assert.equal(bakery?.isSuggestion, false);

    const deletedSuggestions = (await reads.categories({ includeDeleted: true }).all())
      .filter((row) => row.isSuggestion === true && row.deletedAt !== null);
    assert.equal(deletedSuggestions.length, 32);
    assert.equal(await data.requireActiveLeafCategory(customLeaf.id).then((row) => row.name), 'Bakery');
  } finally {
    database.close();
  }
});

test('overlapping leaf creation and suggestion deletion cannot orphan the leaf', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createCategoryData(createProxyDatabase(database));
    const foodId = categoryId(database, 'Food');

    const [customLeaf] = await Promise.all([
      data.createCategory({
        level: 'leaf',
        name: 'Bakery',
        sort: 10,
        groupId: foodId,
      }),
      data.deleteSuggestedCategories(),
    ]);

    assert.equal(customLeaf.level, 'leaf');
    assert.equal(
      await data.requireActiveLeafCategory(customLeaf.id).then((row) => row.name),
      'Bakery'
    );
  } finally {
    database.close();
  }
});
