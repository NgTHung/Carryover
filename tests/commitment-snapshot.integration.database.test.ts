import { strict as assert } from 'node:assert';

import { readBudgetInput } from '../src/budget/snapshot-source';
import type { BudgetSnapshot } from '../src/budget/snapshot';
import {
  createSnapshotPublisher,
  startSnapshotPublisher,
} from '../src/budget/snapshot-publisher';
import { createSnapshotStore } from '../src/budget/snapshot-store';
import { createAccountData } from '../src/data/accounts';
import { createCategoryData } from '../src/data/categories';
import { createCommitmentData } from '../src/data/commitments';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createManualTransactionData } from '../src/data/manual-transactions';
import { createMonthConfigData } from '../src/data/month-config';
import { createPeriodPreparationData } from '../src/data/period-preparation';
import { createReservePaymentData } from '../src/data/reserve-payments';
import { createShareData } from '../src/data/shares';
import { createTransactionData } from '../src/data/transactions';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const now = new Date(2026, 8, 15, 12);
const reserveLeafId = '20000000-0000-4000-8000-000000000007';
const otherReserveLeafId = '20000000-0000-4000-8000-000000000008';
const spendLeafId = '20000000-0000-4000-8000-000000000001';

function bankId(database: ReturnType<typeof openMigratedDatabase>): string {
  const row = database
    .prepare("SELECT id FROM accounts WHERE name = 'Bank'")
    .get() as { id: string } | undefined;
  if (row === undefined) throw new Error('Missing bank account');
  return row.id;
}

function tableCount(
  database: ReturnType<typeof openMigratedDatabase>,
  table: 'commitments' | 'transactions'
): number {
  return (
    database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
      count: number;
    }
  ).count;
}

async function waitFor(
  condition: () => boolean,
  message: string
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error(message);
}

function readySnapshot(
  publisher: ReturnType<typeof createSnapshotPublisher>
): BudgetSnapshot {
  const state = publisher.store.getState();
  if (state.status !== 'ready') {
    throw new Error(`Expected ready snapshot, received ${state.status}`);
  }
  return state.snapshot;
}

function createHarness(database: ReturnType<typeof openMigratedDatabase>) {
  const proxy = createProxyDatabase(database);
  const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
  const silentNotifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
  const preparation = createPeriodPreparationData(proxy, {
    now: () => now,
    changeNotifier: silentNotifier,
  });
  const monthConfigs = createMonthConfigData(proxy, silentNotifier);
  const commitments = createCommitmentData(proxy, notifier);
  const transactions = createTransactionData(
    proxy,
    createCategoryData(proxy, silentNotifier),
    silentNotifier
  );
  const reads = {
    accounts: createAccountData(proxy, silentNotifier),
    commitments: createCommitmentData(proxy, silentNotifier),
    monthConfig: monthConfigs,
    shares: createShareData(proxy),
    transactions,
  };
  const written: BudgetSnapshot[] = [];
  let failWrite = false;
  const publisher = createSnapshotPublisher({
    store: createSnapshotStore(),
    now: () => now,
    readInput: (at) => readBudgetInput(reads, at),
    writer(snapshot) {
      if (failWrite) throw new Error('shared storage unavailable');
      written.push(snapshot);
    },
  });
  return {
    proxy,
    notifier,
    preparation,
    monthConfigs,
    commitments,
    transactions,
    publisher,
    written,
    setWriteFailure(value: boolean) {
      failWrite = value;
    },
  };
}

test('commitment mutations publish live reserves without rewriting month config snapshots', async () => {
  const database = openMigratedDatabase();
  try {
    database
      .prepare("UPDATE accounts SET opening_balance = 10000000 WHERE name = 'Bank'")
      .run();
    const harness = createHarness(database);
    const past = await harness.monthConfigs.openPeriod({
      period: '2026-08',
      openingBalance: 8_000_000,
      incomeTotal: 3_000_000,
      reservedTotal: 2_000_000,
      horizonDate: '2026-08-24',
    });
    await harness.preparation.prepareCurrentPeriod(now);
    const currentBefore = await harness.monthConfigs.readMonthConfig('2026-09');
    const pastBefore = await harness.monthConfigs.readMonthConfig(past.period);
    assert.ok(currentBefore);
    assert.ok(pastBefore);

    const stop = startSnapshotPublisher(harness.publisher, harness.notifier);
    await waitFor(() => harness.written.length === 1, 'Initial snapshot did not publish');
    assert.equal(readySnapshot(harness.publisher).reservedUnpaid, 0);

    const commitment = await harness.commitments.createCommitment({
      name: 'Rent',
      amount: 700_000,
      dueDay: 5,
      categoryId: reserveLeafId,
    });
    await waitFor(() => harness.written.length === 2, 'Create did not publish once');
    assert.equal(tableCount(database, 'transactions'), 0);
    assert.deepEqual(await harness.monthConfigs.readMonthConfig('2026-09'), currentBefore);
    assert.deepEqual(await harness.monthConfigs.readMonthConfig(past.period), pastBefore);
    assert.deepEqual(readySnapshot(harness.publisher), {
      ...readySnapshot(harness.publisher),
      balanceTotal: 10_000_000,
      reservedUnpaid: 700_000,
      discretionary: 9_300_000,
      perDay: 620_000,
    });

    await harness.commitments.editCommitment({
      commitmentId: commitment.id,
      changes: { amount: 900_000 },
    });
    await waitFor(() => harness.written.length === 3, 'Amount edit did not publish once');
    assert.equal(readySnapshot(harness.publisher).reservedUnpaid, 900_000);

    await harness.commitments.editCommitment({
      commitmentId: commitment.id,
      changes: { categoryId: otherReserveLeafId },
    });
    await waitFor(() => harness.written.length === 4, 'Leaf edit did not publish once');
    assert.equal(readySnapshot(harness.publisher).reservedUnpaid, 900_000);

    await assert.rejects(
      harness.commitments.editCommitment({
        commitmentId: commitment.id,
        changes: { categoryId: spendLeafId },
      }),
      /active reserve category leaf/i
    );
    await waitFor(
      () => harness.publisher.store.getState().status === 'ready',
      'Publisher did not settle after rejected edit'
    );
    assert.equal(harness.written.length, 4);

    await harness.commitments.editCommitment({
      commitmentId: commitment.id,
      changes: { active: false },
    });
    await waitFor(() => harness.written.length === 5, 'Deactivation did not publish once');
    assert.equal(readySnapshot(harness.publisher).reservedUnpaid, 0);

    await harness.commitments.editCommitment({
      commitmentId: commitment.id,
      changes: { active: true },
    });
    await waitFor(() => harness.written.length === 6, 'Reactivation did not publish once');
    assert.equal(readySnapshot(harness.publisher).reservedUnpaid, 900_000);

    await harness.commitments.softDeleteCommitment(commitment.id);
    await waitFor(() => harness.written.length === 7, 'Deletion did not publish once');
    assert.equal(readySnapshot(harness.publisher).reservedUnpaid, 0);
    assert.deepEqual(await harness.monthConfigs.readMonthConfig('2026-09'), currentBefore);
    assert.deepEqual(await harness.monthConfigs.readMonthConfig(past.period), pastBefore);
    stop();
  } finally {
    database.close();
  }
});

test('reserve payment publishes one expense and leaves the next duplicate reserved', async () => {
  const database = openMigratedDatabase();
  try {
    database
      .prepare("UPDATE accounts SET opening_balance = 10000000 WHERE name = 'Bank'")
      .run();
    const harness = createHarness(database);
    const past = await harness.monthConfigs.openPeriod({
      period: '2026-08',
      openingBalance: 8_000_000,
      incomeTotal: 3_000_000,
      reservedTotal: 2_000_000,
      horizonDate: '2026-08-24',
    });
    const earlier = await harness.commitments.createCommitment({
      name: 'Earlier rent',
      amount: 700_000,
      dueDay: 5,
      categoryId: reserveLeafId,
    });
    const later = await harness.commitments.createCommitment({
      name: 'Later rent',
      amount: 800_000,
      dueDay: 20,
      categoryId: reserveLeafId,
    });
    await harness.preparation.prepareCurrentPeriod(now);
    const currentBefore = await harness.monthConfigs.readMonthConfig('2026-09');
    const pastBefore = await harness.monthConfigs.readMonthConfig(past.period);
    assert.ok(currentBefore);
    assert.ok(pastBefore);

    const stop = startSnapshotPublisher(harness.publisher, harness.notifier);
    await waitFor(() => harness.written.length === 1, 'Initial snapshot did not publish');
    assert.equal(readySnapshot(harness.publisher).reservedUnpaid, 1_500_000);

    const payments = createReservePaymentData(
      harness.proxy,
      harness.notifier,
      { now: () => now }
    );
    const payment = await payments.createReservePayment({
      commitmentId: earlier.id,
      period: '2026-09',
      transaction: {
        accountId: bankId(database),
        direction: 'expense',
        status: 'complete',
        amount: 725_000,
        categoryId: reserveLeafId,
        occurredAt: now,
        quality: 'need',
      },
    });
    await waitFor(() => harness.written.length === 2, 'Payment did not publish once');

    assert.equal(tableCount(database, 'transactions'), 1);
    assert.equal(
      (
        database
          .prepare("SELECT COUNT(*) AS count FROM transactions WHERE direction = 'income'")
          .get() as { count: number }
      ).count,
      0
    );
    assert.equal(
      (
        await createAccountData(harness.proxy).readAccountBalances()
      ).find(({ accountId }) => accountId === bankId(database))?.balance,
      9_275_000
    );
    assert.equal(
      (await harness.monthConfigs.readMonthConfig('2026-09'))?.incomeTotal,
      currentBefore.incomeTotal
    );
    const overview = await harness.commitments.readCommitmentOverview('2026-09');
    assert.deepEqual(
      overview.items.find(({ commitment }) => commitment.id === earlier.id)?.state,
      { status: 'paid', transactionId: payment.id }
    );
    assert.deepEqual(
      overview.items.find(({ commitment }) => commitment.id === later.id)?.state,
      { status: 'unpaid', nextToAcceptPayment: true }
    );
    assert.equal(readySnapshot(harness.publisher).reservedUnpaid, 800_000);
    assert.equal(readySnapshot(harness.publisher).balanceTotal, 9_275_000);
    assert.equal(readySnapshot(harness.publisher).discretionary, 8_475_000);
    assert.equal(readySnapshot(harness.publisher).spentThisMonth, 725_000);
    assert.deepEqual(await harness.monthConfigs.readMonthConfig(past.period), pastBefore);

    const manual = createManualTransactionData(
      harness.proxy,
      createCategoryData(harness.proxy),
      harness.notifier,
      { now: () => now }
    );
    await manual.softDeleteTransaction(payment.id);
    await waitFor(() => harness.written.length === 3, 'Payment deletion did not publish once');
    assert.equal(readySnapshot(harness.publisher).reservedUnpaid, 1_500_000);
    assert.equal(readySnapshot(harness.publisher).balanceTotal, 10_000_000);
    assert.deepEqual(await harness.monthConfigs.readMonthConfig('2026-09'), currentBefore);
    assert.deepEqual(await harness.monthConfigs.readMonthConfig(past.period), pastBefore);
    stop();
  } finally {
    database.close();
  }
});

test('publication failure keeps a committed commitment and retry rereads it once', async () => {
  const database = openMigratedDatabase();
  try {
    database
      .prepare("UPDATE accounts SET opening_balance = 1000000 WHERE name = 'Bank'")
      .run();
    const harness = createHarness(database);
    await harness.preparation.prepareCurrentPeriod(now);
    const stop = startSnapshotPublisher(harness.publisher, harness.notifier);
    await waitFor(() => harness.written.length === 1, 'Initial snapshot did not publish');

    harness.setWriteFailure(true);
    await harness.commitments.createCommitment({
      name: 'Rent',
      amount: 100_000,
      dueDay: 5,
      categoryId: reserveLeafId,
    });
    await waitFor(
      () => harness.publisher.store.getState().status === 'error',
      'Publisher did not expose the storage failure'
    );
    assert.equal(tableCount(database, 'commitments'), 1);
    assert.equal(tableCount(database, 'transactions'), 0);

    harness.setWriteFailure(false);
    await harness.publisher.retry();
    assert.equal(tableCount(database, 'commitments'), 1);
    assert.equal(readySnapshot(harness.publisher).reservedUnpaid, 100_000);
    assert.equal(readySnapshot(harness.publisher).discretionary, 900_000);
    assert.equal(harness.written.length, 2);
    stop();
  } finally {
    database.close();
  }
});
