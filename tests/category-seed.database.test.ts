import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import migrations from '../drizzle/migrations';

import { openMigratedDatabase } from './support/sqlite-proxy';

type CategoryRow = {
  id: unknown;
  parent_id: unknown;
  name: unknown;
  sort: unknown;
  kind: unknown;
  is_suggestion: unknown;
  deleted_at: unknown;
};

const seedMigration = readFileSync(
  resolve(process.cwd(), 'drizzle/0004_seed-categories.sql'),
  'utf8'
);

function applySeed(database: ReturnType<typeof openMigratedDatabase>): void {
  for (const statement of seedMigration.split('--> statement-breakpoint')) {
    database.prepare(statement).run();
  }
}

function categoryId(
  database: ReturnType<typeof openMigratedDatabase>,
  name: string
): string {
  const row = database
    .prepare('SELECT id FROM categories WHERE name = ? AND deleted_at IS NULL')
    .get(name) as { id: unknown } | undefined;
  if (!row || typeof row.id !== 'string') {
    throw new Error(`Missing active category ${name}`);
  }
  return row.id;
}

test('the first-run migration seeds the specified two-level taxonomy', () => {
  const database = openMigratedDatabase();
  try {
    const rows = database
      .prepare(
        'SELECT id, parent_id, name, sort, kind, is_suggestion, deleted_at FROM categories WHERE deleted_at IS NULL ORDER BY parent_id IS NOT NULL, sort'
      )
      .all() as CategoryRow[];
    const groups = rows.filter((row) => row.parent_id === null);
    const leaves = rows.filter((row) => row.parent_id !== null);

    assert.equal(rows.length, 33);
    assert.equal(groups.length, 8);
    assert.equal(leaves.length, 25);
    assert.equal(
      groups.map((row) => String(row.name)).join('|'),
      'Food|Coffee|Rent|Bills|Transport|Personal|Fun|Misc'
    );
    assert.equal(
      groups.filter((row) => row.kind === 'reserve').length,
      2
    );
    assert.equal(
      leaves.filter((row) => row.kind === 'reserve').length,
      7
    );
    assert.ok(rows.every((row) => row.is_suggestion === 1));
    assert.ok(rows.every((row) => row.deleted_at === null));

    const groupIds = new Set(groups.map((row) => row.id));
    assert.ok(
      leaves.every((row) => typeof row.parent_id === 'string' && groupIds.has(row.parent_id))
    );
    assert.equal(
      rows.find((row) => row.name === 'Coffee')?.parent_id,
      null
    );
    assert.equal(
      leaves.filter((row) => row.parent_id === categoryId(database, 'Rent'))[0]?.kind,
      'reserve'
    );
    assert.ok(
      leaves
        .filter((row) => row.parent_id === categoryId(database, 'Bills'))
        .every((row) => row.kind === 'reserve')
    );
  } finally {
    database.close();
  }
});

test('the migration is registered in the Expo migration bundle', () => {
  const entries = migrations.journal.entries;
  const lastEntry = entries[entries.length - 1];
  assert.equal(lastEntry?.tag, '0004_seed-categories');
  assert.equal(typeof migrations.migrations.m0004, 'string');
});

test('replaying the seed does not restore renamed or deleted rows', () => {
  const database = openMigratedDatabase();
  try {
    const foodId = categoryId(database, 'Food');
    const leafId = categoryId(database, 'Groceries');
    database
      .prepare('UPDATE categories SET name = ? WHERE id = ?')
      .run('Food renamed', foodId);
    database
      .prepare('UPDATE categories SET deleted_at = ? WHERE id = ?')
      .run(1735689600000, leafId);

    applySeed(database);

    const renamed = database
      .prepare('SELECT name, deleted_at FROM categories WHERE id = ?')
      .get(foodId) as { name: unknown; deleted_at: unknown };
    const deleted = database
      .prepare('SELECT name, deleted_at FROM categories WHERE id = ?')
      .get(leafId) as { name: unknown; deleted_at: unknown };
    const total = database
      .prepare('SELECT COUNT(*) AS count FROM categories')
      .get() as { count: unknown };

    assert.equal(renamed.name, 'Food renamed');
    assert.equal(renamed.deleted_at, null);
    assert.equal(deleted.name, 'Groceries');
    assert.equal(deleted.deleted_at, 1735689600000);
    assert.equal(total.count, 33);
  } finally {
    database.close();
  }
});
