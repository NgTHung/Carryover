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
import { createMonthConfigData } from '../src/data/month-config';
import { createMonthSummaryData } from '../src/data/month-summary';
import { createPeriodPreparationData } from '../src/data/period-preparation';
import { createShareData } from '../src/data/shares';
import { createTransactionData } from '../src/data/transactions';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

type Clock = () => Date;

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

function monthConfigRows(
  database: ReturnType<typeof openMigratedDatabase>
): Array<Record<string, unknown>> {
  return database
    .prepare(
      `SELECT id, created_at, updated_at, deleted_at, period,
              opening_balance, income_total, reserved_total, horizon_date
       FROM month_config
       ORDER BY period`
    )
    .all() as Array<Record<string, unknown>>;
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

function assertWriterMatchesStore(
  publisher: ReturnType<typeof createSnapshotPublisher>,
  written: readonly BudgetSnapshot[]
): void {
  const latest = written[written.length - 1];
  if (latest === undefined) throw new Error('Expected a written snapshot');
  assert.equal(readySnapshot(publisher), latest);
}

function createHarness(
  database: ReturnType<typeof openMigratedDatabase>,
  clock: Clock
) {
  const proxy = createProxyDatabase(database);
  const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
  const preparationNotifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
  const preparation = createPeriodPreparationData(proxy, {
    now: clock,
    changeNotifier: preparationNotifier,
  });
  const monthConfigs = createMonthConfigData(proxy, notifier);
  const reads = {
    accounts: createAccountData(proxy, preparationNotifier),
    commitments: createCommitmentData(proxy, preparationNotifier),
    monthConfig: monthConfigs,
    shares: createShareData(proxy),
    transactions: createTransactionData(
      proxy,
      createCategoryData(proxy, preparationNotifier),
      preparationNotifier
    ),
  };
  const written: BudgetSnapshot[] = [];
  let failWrite = false;
  const publisher = createSnapshotPublisher({
    store: createSnapshotStore(),
    now: clock,
    readInput: async (at) => {
      await preparation.prepareCurrentPeriod(at);
      return readBudgetInput(reads, at);
    },
    writer(snapshot) {
      if (failWrite) throw new Error('shared storage unavailable');
      written.push(snapshot);
    },
  });
  return {
    proxy,
    notifier,
    monthConfigs,
    preparation,
    publisher,
    written,
    setWriteFailure(value: boolean) {
      failWrite = value;
    },
  };
}

async function openCurrentConfig(
  harness: ReturnType<typeof createHarness>,
  horizonDate = '2026-09-30'
): Promise<void> {
  await harness.monthConfigs.openPeriod({
    period: '2026-09',
    openingBalance: 150_000,
    incomeTotal: 0,
    reservedTotal: 0,
    horizonDate,
  });
}

test('horizon edits publish exact per-day values and preserve the no-op contract', async () => {
  const database = openMigratedDatabase();
  try {
    database
      .prepare("UPDATE accounts SET opening_balance = 150000 WHERE name = 'Bank'")
      .run();
    const clock = () => new Date(2026, 8, 15, 12);
    const harness = createHarness(database, clock);
    await openCurrentConfig(harness);
    const changes: string[] = [];
    harness.notifier.subscribe(({ table, mutation }) => {
      changes.push(`${table}:${mutation}`);
    });

    const stop = startSnapshotPublisher(harness.publisher, harness.notifier);
    await waitFor(() => harness.written.length === 1, 'Initial snapshot did not publish');
    assert.equal(readySnapshot(harness.publisher).discretionary, 150_000);
    assert.equal(readySnapshot(harness.publisher).perDay, 10_000);
    assertWriterMatchesStore(harness.publisher, harness.written);

    await harness.monthConfigs.updateHorizon({
      period: '2026-09',
      horizonDate: '2026-10-15',
    });
    await waitFor(() => harness.written.length === 2, 'Future horizon did not publish');
    assert.equal(readySnapshot(harness.publisher).horizonDate, '2026-10-15');
    assert.equal(readySnapshot(harness.publisher).perDay, 5_000);
    assertWriterMatchesStore(harness.publisher, harness.written);

    await harness.monthConfigs.updateHorizon({
      period: '2026-09',
      horizonDate: '2026-09-15',
    });
    await waitFor(() => harness.written.length === 3, 'Today horizon did not publish');
    assert.equal(readySnapshot(harness.publisher).daysToHorizon, 0);
    assert.equal(readySnapshot(harness.publisher).perDay, null);

    await harness.monthConfigs.updateHorizon({
      period: '2026-09',
      horizonDate: '2026-09-01',
    });
    await waitFor(() => harness.written.length === 4, 'Elapsed horizon did not publish');
    assert.equal(readySnapshot(harness.publisher).daysToHorizon, 0);
    assert.equal(readySnapshot(harness.publisher).perDay, null);

    const rowsBeforeInvalid = monthConfigRows(database);
    const writesBeforeInvalid = harness.written.length;
    const changesBeforeInvalid = changes.length;
    await assert.rejects(
      harness.monthConfigs.updateHorizon({
        period: '2026-09',
        horizonDate: '2026-09-31',
      })
    );
    assert.equal(harness.written.length, writesBeforeInvalid);
    assert.equal(changes.length, changesBeforeInvalid);
    assert.deepEqual(monthConfigRows(database), rowsBeforeInvalid);

    await harness.monthConfigs.updateHorizon({
      period: '2026-09',
      horizonDate: '2026-09-01',
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(harness.written.length, writesBeforeInvalid);
    assert.equal(changes.length, changesBeforeInvalid);
    assert.deepEqual(monthConfigRows(database), rowsBeforeInvalid);
    stop();
  } finally {
    database.close();
  }
});

test('a horizon edit changes only the selected config and leaves historical summaries frozen', async () => {
  const database = openMigratedDatabase();
  try {
    database
      .prepare("UPDATE accounts SET opening_balance = 150000 WHERE name = 'Bank'")
      .run();
    const clock = () => new Date(2026, 8, 15, 12);
    const harness = createHarness(database, clock);
    await harness.monthConfigs.openPeriod({
      period: '2026-07',
      openingBalance: 7_000_000,
      incomeTotal: 1_000_000,
      reservedTotal: 500_000,
      horizonDate: '2026-07-31',
    });
    await harness.monthConfigs.openPeriod({
      period: '2026-08',
      openingBalance: 8_000_000,
      incomeTotal: 3_000_000,
      reservedTotal: 2_000_000,
      horizonDate: '2026-08-24',
    });
    await openCurrentConfig(harness);
    const summaryData = createMonthSummaryData(harness.proxy);
    const historicalBefore = await summaryData.readMonthSummary('2026-08', '2026-08-20');
    assert.ok(historicalBefore);
    const rowsBefore = monthConfigRows(database);
    const currentBefore = rowsBefore.find(({ period }) => period === '2026-09');
    assert.ok(currentBefore);

    const stop = startSnapshotPublisher(harness.publisher, harness.notifier);
    await waitFor(() => harness.written.length === 1, 'Initial snapshot did not publish');
    await harness.monthConfigs.updateHorizon({
      period: '2026-09',
      horizonDate: '2026-10-15',
    });
    await waitFor(() => harness.written.length === 2, 'Horizon edit did not publish');

    const rowsAfter = monthConfigRows(database);
    const currentAfter = rowsAfter.find(({ period }) => period === '2026-09');
    assert.ok(currentAfter);
    assert.equal(currentAfter.opening_balance, currentBefore.opening_balance);
    assert.equal(currentAfter.income_total, currentBefore.income_total);
    assert.equal(currentAfter.reserved_total, currentBefore.reserved_total);
    assert.equal(currentAfter.horizon_date, '2026-10-15');
    assert.notEqual(currentAfter.updated_at, currentBefore.updated_at);
    assert.deepEqual(
      rowsAfter.filter(({ period }) => period !== '2026-09'),
      rowsBefore.filter(({ period }) => period !== '2026-09')
    );

    const historicalAfter = await summaryData.readMonthSummary('2026-08', '2026-08-20');
    assert.deepEqual(historicalAfter, historicalBefore);
    stop();
  } finally {
    database.close();
  }
});

test('saving a previous period after rollover publishes the new current period config', async () => {
  const database = openMigratedDatabase();
  try {
    database
      .prepare("UPDATE accounts SET opening_balance = 150000 WHERE name = 'Bank'")
      .run();
    let currentTime = new Date(2026, 8, 15, 12);
    const harness = createHarness(database, () => currentTime);
    await openCurrentConfig(harness, '2026-10-15');
    const stop = startSnapshotPublisher(harness.publisher, harness.notifier);
    await waitFor(() => harness.written.length === 1, 'Initial snapshot did not publish');

    currentTime = new Date(2026, 9, 1, 12);
    await harness.monthConfigs.updateHorizon({
      period: '2026-09',
      horizonDate: '2026-10-20',
    });
    await waitFor(() => harness.written.length === 2, 'Rollover horizon edit did not publish');

    assert.equal(
      (await harness.monthConfigs.readMonthConfig('2026-09'))?.horizonDate,
      '2026-10-20'
    );
    assert.equal(
      (await harness.monthConfigs.readMonthConfig('2026-10'))?.horizonDate,
      '2026-10-31'
    );
    assert.equal(readySnapshot(harness.publisher).horizonDate, '2026-10-31');
    stop();
  } finally {
    database.close();
  }
});

test('publication failure leaves the committed horizon in SQLite and retry does not mutate again', async () => {
  const database = openMigratedDatabase();
  try {
    database
      .prepare("UPDATE accounts SET opening_balance = 150000 WHERE name = 'Bank'")
      .run();
    const clock = () => new Date(2026, 8, 15, 12);
    const harness = createHarness(database, clock);
    await openCurrentConfig(harness);
    let mutations = 0;
    harness.notifier.subscribe(({ table }) => {
      if (table === 'month_config') mutations += 1;
    });
    const stop = startSnapshotPublisher(harness.publisher, harness.notifier);
    await waitFor(() => harness.written.length === 1, 'Initial snapshot did not publish');

    harness.setWriteFailure(true);
    await harness.monthConfigs.updateHorizon({
      period: '2026-09',
      horizonDate: '2026-10-15',
    });
    await waitFor(
      () => harness.publisher.store.getState().status === 'error',
      'Publisher did not expose the storage failure'
    );
    assert.equal((await harness.monthConfigs.readMonthConfig('2026-09'))?.horizonDate, '2026-10-15');
    assert.equal(mutations, 1);

    harness.setWriteFailure(false);
    await harness.publisher.retry();
    assert.equal(harness.publisher.store.getState().status, 'ready');
    assert.equal(readySnapshot(harness.publisher).horizonDate, '2026-10-15');
    assert.equal(harness.written.length, 2);
    assert.equal(mutations, 1);
    stop();
  } finally {
    database.close();
  }
});
