import { strict as assert } from 'node:assert';

import { createCommitmentData } from '../src/data/commitments';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const reserveLeafId = '20000000-0000-4000-8000-000000000007';
const secondReserveLeafId = '20000000-0000-4000-8000-000000000008';
const spendLeafId = '20000000-0000-4000-8000-000000000001';
const reserveGroupId = '10000000-0000-4000-8000-000000000003';

function databaseCount(database: ReturnType<typeof openMigratedDatabase>, table: string): number {
  return (database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;
}

test('commitments round-trip with active default and notify actual writes', async () => {
  const database = openMigratedDatabase();
  try {
    const changes: string[] = [];
    const notifier = createLedgerChangeNotifier();
    notifier.subscribe(({ table, mutation }) => changes.push(`${table}:${mutation}`));
    const data = createCommitmentData(createProxyDatabase(database), notifier);

    const created = await data.createCommitment({
      name: '  Rent  ',
      amount: '700000',
      dueDay: 31,
      categoryId: reserveLeafId,
    });
    assert.equal(created.name, 'Rent');
    assert.equal(created.amount, 700_000);
    assert.equal(created.dueDay, 31);
    assert.equal(created.categoryId, reserveLeafId);
    assert.equal(created.active, true);
    assert.equal(created.deletedAt, null);
    assert.deepEqual(await data.readCommitment(created.id), created);
    const commitments = await data.readCommitments();
    assert.equal(commitments.length, 1);
    assert.equal(commitments[0]?.id, created.id);
    assert.deepEqual(changes, ['commitments:created']);

    await assert.rejects(
      data.editCommitment({
        commitmentId: created.id,
        changes: { categoryId: spendLeafId },
      }),
      /active reserve category leaf/i
    );
    assert.equal((await data.readCommitment(created.id))?.categoryId, reserveLeafId);

    const unchanged = await data.editCommitment({
      commitmentId: created.id,
      changes: {},
    });
    assert.deepEqual(unchanged, created);
    assert.deepEqual(changes, ['commitments:created']);

    const edited = await data.editCommitment({
      commitmentId: created.id,
      changes: { name: 'Rent changed', amount: 800_000, categoryId: secondReserveLeafId },
    });
    assert.equal(edited.name, 'Rent changed');
    assert.equal(edited.amount, 800_000);
    assert.equal(edited.categoryId, secondReserveLeafId);
    assert.deepEqual(changes, ['commitments:created', 'commitments:edited']);

    await data.softDeleteCommitment(created.id);
    assert.equal(await data.readCommitment(created.id), undefined);
    assert.equal((await data.readCommitments()).length, 0);
    assert.equal((await data.readCommitment(created.id, { includeDeleted: true }))?.id, created.id);
    assert.deepEqual(changes, [
      'commitments:created',
      'commitments:edited',
      'commitments:deleted',
    ]);
  } finally {
    database.close();
  }
});

test('writes reject non-reserve, group, deleted, and missing categories without rows', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createCommitmentData(createProxyDatabase(database));
    const before = databaseCount(database, 'commitments');
    database
      .prepare('UPDATE categories SET deleted_at = ? WHERE id = ?')
      .run(Date.now(), secondReserveLeafId);

    for (const categoryId of [spendLeafId, reserveGroupId, secondReserveLeafId, '44444444-4444-4444-8444-444444444444']) {
      await assert.rejects(
        data.createCommitment({ name: 'Invalid', amount: 1_000, dueDay: 1, categoryId }),
        /active reserve category leaf/i
      );
    }
    for (const input of [
      { name: '', amount: 1_000, dueDay: 1, categoryId: reserveLeafId },
      { name: 'Invalid', amount: 0, dueDay: 1, categoryId: reserveLeafId },
      { name: 'Invalid', amount: 1_000, dueDay: 0, categoryId: reserveLeafId },
    ]) {
      await assert.rejects(data.createCommitment(input));
    }
    assert.equal(databaseCount(database, 'commitments'), before);
  } finally {
    database.close();
  }
});

test('deactivation remains possible after a category is unavailable, but reactivation validates it', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createCommitmentData(createProxyDatabase(database));
    const created = await data.createCommitment({
      name: 'Rent',
      amount: 700_000,
      dueDay: 5,
      categoryId: reserveLeafId,
    });
    database
      .prepare('UPDATE categories SET deleted_at = ? WHERE id = ?')
      .run(Date.now(), reserveLeafId);

    const deactivated = await data.editCommitment({
      commitmentId: created.id,
      changes: { active: false },
    });
    assert.equal(deactivated.active, false);
    await assert.rejects(
      data.editCommitment({ commitmentId: created.id, changes: { active: true } }),
      /active reserve category leaf/i
    );
    assert.equal((await data.readCommitment(created.id))?.active, false);
  } finally {
    database.close();
  }
});

test('commitment writes never create transactions', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createCommitmentData(createProxyDatabase(database));
    const before = databaseCount(database, 'transactions');
    const created = await data.createCommitment({
      name: 'Rent',
      amount: 700_000,
      dueDay: 5,
      categoryId: reserveLeafId,
    });
    await data.editCommitment({ commitmentId: created.id, changes: { amount: 800_000 } });
    await data.softDeleteCommitment(created.id);
    assert.equal(databaseCount(database, 'transactions'), before);
  } finally {
    database.close();
  }
});
