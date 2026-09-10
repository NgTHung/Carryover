import { strict as assert } from 'node:assert';

import { createCategoryData } from '../src/data/categories';
import { createCommitmentData } from '../src/data/commitments';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { MAX_VND_AMOUNT } from '../src/money/currency';
import { createTransactionData } from '../src/data/transactions';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const reserveLeafId = '20000000-0000-4000-8000-000000000007';
const secondReserveLeafId = '20000000-0000-4000-8000-000000000008';
const spendLeafId = '20000000-0000-4000-8000-000000000001';
const reserveGroupId = '10000000-0000-4000-8000-000000000003';
const secondSpendLeafId = '20000000-0000-4000-8000-000000000002';

function databaseCount(database: ReturnType<typeof openMigratedDatabase>, table: string): number {
  return (database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;
}

function bankId(database: ReturnType<typeof openMigratedDatabase>): string {
  return (
    database.prepare("SELECT id FROM accounts WHERE name = 'Bank'").get() as {
      id: string;
    }
  ).id;
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

test('reserved unpaid matches complete expenses once within the requested period', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const commitments = createCommitmentData(proxy);
    const transactions = createTransactionData(proxy, createCategoryData(proxy));
    const first = await commitments.createCommitment({
      name: 'Rent first',
      amount: 700_000,
      dueDay: 5,
      categoryId: reserveLeafId,
    });
    await commitments.createCommitment({
      name: 'Rent second',
      amount: 800_000,
      dueDay: 20,
      categoryId: reserveLeafId,
    });
    const bank = bankId(database);
    await transactions.createTransaction({
      accountId: bank,
      direction: 'expense',
      status: 'complete',
      amount: 1,
      categoryId: reserveLeafId,
      occurredAt: new Date(2026, 8, 6),
    });
    await transactions.createTransaction({
      accountId: bank,
      direction: 'expense',
      status: 'draft',
      amount: null,
      categoryId: reserveLeafId,
      occurredAt: new Date(2026, 8, 7),
    });
    assert.equal(await commitments.readReservedUnpaid('2026-09'), 800_000);
    assert.equal(await commitments.readReservedUnpaid('2026-08'), 1_500_000);
    assert.equal(first.active, true);
  } finally {
    database.close();
  }
});

test('reserved unpaid uses the period start and excludes the next period start', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const commitments = createCommitmentData(proxy);
    const transactions = createTransactionData(proxy, createCategoryData(proxy));
    await commitments.createCommitment({
      name: 'September rent',
      amount: 700_000,
      dueDay: 1,
      categoryId: reserveLeafId,
    });
    await commitments.createCommitment({
      name: 'Second reserve',
      amount: 800_000,
      dueDay: 1,
      categoryId: secondReserveLeafId,
    });
    const bank = bankId(database);
    await transactions.createTransaction({
      accountId: bank,
      direction: 'expense',
      status: 'complete',
      amount: 1,
      categoryId: reserveLeafId,
      occurredAt: new Date(2026, 8, 1, 0, 0, 0, 0),
    });
    await transactions.createTransaction({
      accountId: bank,
      direction: 'expense',
      status: 'complete',
      amount: 1,
      categoryId: secondReserveLeafId,
      occurredAt: new Date(2026, 9, 1, 0, 0, 0, 0),
    });

    assert.equal(await commitments.readReservedUnpaid('2026-09'), 800_000);
    assert.equal(await commitments.readReservedUnpaid('2026-10'), 700_000);
  } finally {
    database.close();
  }
});

test('reserved unpaid uses one database view during overlapping ledger edits', async () => {
  const database = openMigratedDatabase();
  try {
    const setupProxy = createProxyDatabase(database);
    const commitments = createCommitmentData(setupProxy);
    const transactions = createTransactionData(
      setupProxy,
      createCategoryData(setupProxy)
    );
    const commitment = await commitments.createCommitment({
      name: 'Rent',
      amount: 700_000,
      dueDay: 1,
      categoryId: reserveLeafId,
    });
    const payment = await transactions.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'complete',
      amount: 700_000,
      categoryId: reserveLeafId,
      occurredAt: new Date(2026, 8, 1),
    });
    let changed = false;
    const readProxy = createProxyDatabase(database, {
      afterQuery(query) {
        if (changed || !query.toLowerCase().includes('from "commitments"')) {
          return;
        }
        changed = true;
        const updatedAt = Date.now() + 1;
        database
          .prepare(
            'UPDATE commitments SET amount = ?, category_id = ?, updated_at = ? WHERE id = ?'
          )
          .run(800_000, secondReserveLeafId, updatedAt, commitment.id);
        database
          .prepare(
            'UPDATE transactions SET category_id = ?, updated_at = ? WHERE id = ?'
          )
          .run(secondReserveLeafId, updatedAt, payment.id);
      },
    });

    assert.equal(
      await createCommitmentData(readProxy).readReservedUnpaid('2026-09'),
      0
    );
    assert.equal(changed, true);
    assert.equal(await commitments.readReservedUnpaid('2026-09'), 0);
  } finally {
    database.close();
  }
});

test('reserved unpaid ignores non-payments, deleted rows, and inactive commitments', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const commitments = createCommitmentData(proxy);
    const transactions = createTransactionData(proxy, createCategoryData(proxy));
    const inactive = await commitments.createCommitment({
      name: 'Inactive rent',
      amount: 100_000,
      dueDay: 1,
      categoryId: reserveLeafId,
      active: false,
    });
    const active = await commitments.createCommitment({
      name: 'Active rent',
      amount: 200_000,
      dueDay: 1,
      categoryId: reserveLeafId,
    });
    await commitments.editCommitment({
      commitmentId: inactive.id,
      changes: { active: true },
    });
    await commitments.editCommitment({
      commitmentId: inactive.id,
      changes: { active: false },
    });
    const bank = bankId(database);
    const draft = await transactions.createTransaction({
      accountId: bank,
      direction: 'expense',
      status: 'draft',
      amount: null,
      categoryId: reserveLeafId,
      occurredAt: new Date(2026, 8, 1),
    });
    const income = await transactions.createTransaction({
      accountId: bank,
      direction: 'income',
      status: 'complete',
      amount: 200_000,
      categoryId: null,
      occurredAt: new Date(2026, 8, 1),
    });
    const adjustment = await transactions.createTransaction({
      accountId: bank,
      direction: 'adjustment',
      adjustmentEffect: 'increase',
      status: 'complete',
      amount: 200_000,
      categoryId: null,
      occurredAt: new Date(2026, 8, 1),
    });
    const transfer = await transactions.createTransaction({
      accountId: bank,
      direction: 'transfer',
      status: 'complete',
      amount: 200_000,
      categoryId: null,
      occurredAt: new Date(2026, 8, 1),
    });
    const wrongCategory = await transactions.createTransaction({
      accountId: bank,
      direction: 'expense',
      status: 'complete',
      amount: 200_000,
      categoryId: secondSpendLeafId,
      occurredAt: new Date(2026, 8, 1),
    });
    const deleted = await transactions.createTransaction({
      accountId: bank,
      direction: 'expense',
      status: 'complete',
      amount: 200_000,
      categoryId: reserveLeafId,
      occurredAt: new Date(2026, 8, 1),
    });
    await transactions.softDeleteTransaction(deleted.id);
    assert.equal(await commitments.readReservedUnpaid('2026-09'), 200_000);
    assert.equal((await commitments.readCommitment(active.id))?.active, true);
    assert.equal(draft.status, 'draft');
    assert.equal(income.direction, 'income');
    assert.equal(adjustment.direction, 'adjustment');
    assert.equal(transfer.direction, 'transfer');
    assert.equal(wrongCategory.categoryId, secondSpendLeafId);
  } finally {
    database.close();
  }
});

test('reserved unpaid rejects a result beyond the safe VND amount', async () => {
  const database = openMigratedDatabase();
  try {
    const commitments = createCommitmentData(createProxyDatabase(database));
    await commitments.createCommitment({
      name: 'Large rent one',
      amount: MAX_VND_AMOUNT,
      dueDay: 1,
      categoryId: reserveLeafId,
    });
    await commitments.createCommitment({
      name: 'Large rent two',
      amount: 1,
      dueDay: 2,
      categoryId: reserveLeafId,
    });
    await assert.rejects(
      commitments.readReservedUnpaid('2026-09'),
      /safe VND amount/i
    );
  } finally {
    database.close();
  }
});
