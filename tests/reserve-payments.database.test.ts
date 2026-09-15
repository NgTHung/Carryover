import { strict as assert } from 'node:assert';

import type { AtomicTransactionRunner, LedgerDatabase } from '../src/data/atomic';
import { createCategoryData } from '../src/data/categories';
import { createCommitmentData } from '../src/data/commitments';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createReservePaymentData } from '../src/data/reserve-payments';
import { createTransactionData } from '../src/data/transactions';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const reserveLeafId = '20000000-0000-4000-8000-000000000007';
const otherReserveLeafId = '20000000-0000-4000-8000-000000000008';
const spendLeafId = '20000000-0000-4000-8000-000000000001';
const now = new Date(2026, 8, 15, 12, 30);
const today = new Date(2026, 8, 15, 9);

function bankId(database: ReturnType<typeof openMigratedDatabase>): string {
  return (
    database.prepare("SELECT id FROM accounts WHERE name = 'Bank'").get() as {
      id: string;
    }
  ).id;
}

function rowCount(
  database: ReturnType<typeof openMigratedDatabase>,
  table: 'month_config' | 'transactions'
): number {
  return (
    database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
      count: number;
    }
  ).count;
}

function paymentInput(
  database: ReturnType<typeof openMigratedDatabase>,
  commitmentId: string,
  changes: Partial<{
    categoryId: string;
    direction: 'expense' | 'income';
    occurredAt: Date;
  }> = {}
) {
  const direction = changes.direction ?? 'expense';
  return {
    commitmentId,
    period: '2026-09' as const,
    transaction: {
      accountId: bankId(database),
      direction,
      status: 'complete' as const,
      amount: 725_000,
      categoryId:
        direction === 'expense'
          ? (changes.categoryId ?? reserveLeafId)
          : null,
      occurredAt: changes.occurredAt ?? today,
      quality: 'need' as const,
      note: 'September rent',
    },
  };
}

test('reserve payment records one ordinary expense and clears only the next duplicate commitment', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const commitments = createCommitmentData(proxy);
    const later = await commitments.createCommitment({
      name: 'Later rent',
      amount: 800_000,
      dueDay: 20,
      categoryId: reserveLeafId,
    });
    const earlier = await commitments.createCommitment({
      name: 'Earlier rent',
      amount: 700_000,
      dueDay: 5,
      categoryId: reserveLeafId,
    });
    const changes: string[] = [];
    const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
    notifier.subscribe(({ table, mutation }) => changes.push(`${table}:${mutation}`));
    const payments = createReservePaymentData(proxy, notifier, { now: () => now });

    const created = await payments.createReservePayment(
      paymentInput(database, earlier.id)
    );

    assert.equal(created.direction, 'expense');
    assert.equal(created.status, 'complete');
    assert.equal(created.amount, 725_000);
    assert.equal(created.categoryId, reserveLeafId);
    assert.equal(created.occurredAt.getTime(), today.getTime());
    assert.deepEqual(created.payer, { kind: 'you' });
    assert.equal(created.photoKey, null);
    assert.equal(created.sourceLabel, null);
    assert.equal(created.adjustmentEffect, null);
    assert.equal(rowCount(database, 'transactions'), 1);

    const overview = await commitments.readCommitmentOverview('2026-09');
    assert.deepEqual(
      overview.items.find(({ commitment }) => commitment.id === earlier.id)?.state,
      { status: 'paid', transactionId: created.id }
    );
    assert.deepEqual(
      overview.items.find(({ commitment }) => commitment.id === later.id)?.state,
      { status: 'unpaid', nextToAcceptPayment: true }
    );
    assert.deepEqual(overview.unpaidTotal, {
      status: 'available',
      amount: later.amount,
    });
    assert.deepEqual(changes, [
      'month_config:created',
      'transactions:created',
    ]);
  } finally {
    database.close();
  }
});

test('reserve payment rejects commitment state changes after the overview was loaded', async () => {
  const cases: ReadonlyArray<{
    name: string;
    change: (
      database: ReturnType<typeof openMigratedDatabase>,
      commitmentId: string
    ) => Promise<void> | void;
    message: RegExp;
  }> = [
    {
      name: 'inactive commitment',
      change(database, commitmentId) {
        database
          .prepare('UPDATE commitments SET active = 0 WHERE id = ?')
          .run(commitmentId);
      },
      message: /commitment is inactive/i,
    },
    {
      name: 'deleted commitment',
      change(database, commitmentId) {
        database
          .prepare('UPDATE commitments SET deleted_at = ? WHERE id = ?')
          .run(now.getTime(), commitmentId);
      },
      message: /commitment was not found/i,
    },
    {
      name: 'inactive reserve leaf',
      change(database) {
        database
          .prepare('UPDATE categories SET deleted_at = ? WHERE id = ?')
          .run(now.getTime(), reserveLeafId);
      },
      message: /reserve leaf is inactive/i,
    },
    {
      name: 'already paid commitment',
      async change(database) {
        const proxy = createProxyDatabase(database);
        await createTransactionData(proxy, createCategoryData(proxy)).createTransaction({
          accountId: bankId(database),
          direction: 'expense',
          status: 'complete',
          amount: 1,
          categoryId: reserveLeafId,
          occurredAt: today,
        });
      },
      message: /commitment is already paid/i,
    },
  ];

  for (const example of cases) {
    const database = openMigratedDatabase();
    try {
      const proxy = createProxyDatabase(database);
      const commitments = createCommitmentData(proxy);
      const commitment = await commitments.createCommitment({
        name: example.name,
        amount: 700_000,
        dueDay: 5,
        categoryId: reserveLeafId,
      });
      const loaded = await commitments.readCommitmentOverview('2026-09');
      assert.equal(loaded.items[0]?.state.status, 'unpaid');
      await example.change(database, commitment.id);

      const baselineTransactions = rowCount(database, 'transactions');
      const baselineConfigs = rowCount(database, 'month_config');
      const changes: string[] = [];
      const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
      notifier.subscribe(({ table, mutation }) => changes.push(`${table}:${mutation}`));
      const payments = createReservePaymentData(proxy, notifier, { now: () => now });

      await assert.rejects(
        payments.createReservePayment(paymentInput(database, commitment.id)),
        example.message,
        example.name
      );
      assert.equal(rowCount(database, 'transactions'), baselineTransactions);
      assert.equal(rowCount(database, 'month_config'), baselineConfigs);
      assert.deepEqual(changes, []);
    } finally {
      database.close();
    }
  }
});

test('reserve payment rejects a later duplicate and mismatched transaction intent without side effects', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const commitments = createCommitmentData(proxy);
    const earlier = await commitments.createCommitment({
      name: 'Earlier rent',
      amount: 700_000,
      dueDay: 5,
      categoryId: reserveLeafId,
    });
    const later = await commitments.createCommitment({
      name: 'Later rent',
      amount: 800_000,
      dueDay: 20,
      categoryId: reserveLeafId,
    });
    const changes: string[] = [];
    const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
    notifier.subscribe(({ table, mutation }) => changes.push(`${table}:${mutation}`));
    const payments = createReservePaymentData(proxy, notifier, { now: () => now });

    await assert.rejects(
      payments.createReservePayment(paymentInput(database, later.id)),
      /earlier commitment/i
    );
    await assert.rejects(
      payments.createReservePayment(
        paymentInput(database, earlier.id, { categoryId: otherReserveLeafId })
      ),
      /does not match/i
    );
    await assert.rejects(
      payments.createReservePayment(
        paymentInput(database, earlier.id, { direction: 'income' })
      ),
      /does not match/i
    );
    assert.equal(rowCount(database, 'transactions'), 0);
    assert.equal(rowCount(database, 'month_config'), 0);
    assert.deepEqual(changes, []);

    const first = (await commitments.readCommitmentOverview('2026-09')).items.find(
      ({ state }) => state.status === 'unpaid' && state.nextToAcceptPayment
    );
    if (first === undefined) throw new Error('Missing next commitment');
    await assert.rejects(
      payments.createReservePayment(
        paymentInput(database, first.commitment.id, { categoryId: spendLeafId })
      ),
      /does not match/i
    );
    await assert.rejects(
      payments.createReservePayment(
        paymentInput(database, first.commitment.id, {
          occurredAt: new Date(2026, 7, 31, 9),
        })
      ),
      /selected period/i
    );
    await assert.rejects(
      payments.createReservePayment(
        paymentInput(database, first.commitment.id, {
          occurredAt: new Date(2026, 8, 16, 9),
        })
      ),
      /future/i
    );
    assert.equal(rowCount(database, 'transactions'), 0);
    assert.equal(rowCount(database, 'month_config'), 0);
    assert.deepEqual(changes, []);
  } finally {
    database.close();
  }
});

test('concurrent reserve payment submissions serialize and insert exactly once', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const commitment = await createCommitmentData(proxy).createCommitment({
      name: 'Rent',
      amount: 700_000,
      dueDay: 5,
      categoryId: reserveLeafId,
    });
    const changes: string[] = [];
    const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
    notifier.subscribe(({ table, mutation }) => changes.push(`${table}:${mutation}`));
    const payments = createReservePaymentData(proxy, notifier, { now: () => now });
    const input = paymentInput(database, commitment.id);

    const results = await Promise.allSettled([
      payments.createReservePayment(input),
      payments.createReservePayment(input),
    ]);

    assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1);
    const rejection = results.find(({ status }) => status === 'rejected');
    assert.equal(rejection?.status, 'rejected');
    if (rejection?.status !== 'rejected') {
      throw new Error('Expected one rejected payment');
    }
    assert.match(String(rejection.reason), /already paid/i);
    assert.equal(rowCount(database, 'transactions'), 1);
    assert.deepEqual(changes, [
      'month_config:created',
      'transactions:created',
    ]);
  } finally {
    database.close();
  }
});

test('reserve payment rolls back the expense and period preparation when commit fails', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const commitment = await createCommitmentData(proxy).createCommitment({
      name: 'Rent',
      amount: 700_000,
      dueDay: 5,
      categoryId: reserveLeafId,
    });
    const changes: string[] = [];
    const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
    notifier.subscribe(({ table, mutation }) => changes.push(`${table}:${mutation}`));
    const runAtomic: AtomicTransactionRunner<'async'> = async <T>(
      operation: (transactionDb: LedgerDatabase<'async'>) => Promise<T>
    ) =>
      proxy.transaction(async (transactionDb) => {
        await operation(transactionDb);
        throw new Error('simulated commit failure');
      });
    const payments = createReservePaymentData(proxy, notifier, {
      now: () => now,
      runAtomic,
    });

    await assert.rejects(
      payments.createReservePayment(paymentInput(database, commitment.id)),
      /simulated commit failure/i
    );
    assert.equal(rowCount(database, 'transactions'), 0);
    assert.equal(rowCount(database, 'month_config'), 0);
    assert.deepEqual(changes, []);
  } finally {
    database.close();
  }
});
