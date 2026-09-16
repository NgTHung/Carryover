import { strict as assert } from 'node:assert';

import { createAsyncAtomicRunner } from '../src/data/atomic';
import { createCategoryData } from '../src/data/categories';
import { createDraftInboxData } from '../src/data/draft-inbox';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createManualTransactionData } from '../src/data/manual-transactions';
import { createPeriodPreparationData } from '../src/data/period-preparation';
import { createTransactionData } from '../src/data/transactions';
import type { DraftTransaction } from '../src/data/transaction-validation';
import { startSnapshotPublisher } from '../src/budget/snapshot-publisher';
import type { BudgetSnapshot } from '../src/budget/snapshot';
import {
  bankId,
  completionNow,
  completionPhotoKey,
  createDraftCompletionHarness,
  monthConfigRow,
  readySnapshot,
  spendLeaf,
  waitFor,
} from './support/draft-completion-fixture';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

type DraftHarness = ReturnType<typeof createDraftCompletionHarness>;

async function createDraft(
  harness: DraftHarness,
  input: {
    direction?: 'expense' | 'income';
    amount?: number | null;
    occurredAt?: Date;
    photoKey?: string | null;
  } = {}
): Promise<DraftTransaction> {
  const transaction = await harness.transactions.createTransaction({
    accountId: bankId(harness.database),
    direction: input.direction ?? 'expense',
    status: 'draft',
    amount: input.amount ?? null,
    categoryId: null,
    photoKey: input.photoKey ?? completionPhotoKey,
    occurredAt: input.occurredAt ?? completionNow,
    quality: null,
    note: null,
    sourceLabel: null,
  });
  if (transaction.status !== 'draft') {
    throw new Error('Expected the fixture transaction to remain a draft');
  }
  return transaction;
}

async function startPublisher(harness: DraftHarness): Promise<() => void> {
  const stop = startSnapshotPublisher(harness.publisher, harness.notifier);
  await waitFor(
    () => harness.written.length === 1 && harness.publisher.store.getState().status === 'ready',
    'Initial snapshot did not publish'
  );
  return stop;
}

async function waitForPublished(
  harness: DraftHarness,
  previousWrites: number,
  predicate: (snapshot: BudgetSnapshot) => boolean,
  message: string
): Promise<BudgetSnapshot> {
  await waitFor(
    () => {
      const state = harness.publisher.store.getState();
      return (
        harness.written.length > previousWrites &&
        state.status === 'ready' &&
        predicate(state.snapshot)
      );
    },
    message
  );
  return readySnapshot(harness.publisher);
}

async function readDrafts(harness: DraftHarness): Promise<DraftTransaction[]> {
  return createDraftInboxData(harness.proxy).readActiveDrafts();
}

test('a partial save keeps the same inbox row and completion does not charge it twice', async () => {
  const database = openMigratedDatabase();
  let stop: (() => void) | undefined;
  try {
    database.prepare("UPDATE accounts SET opening_balance = 1000000 WHERE name = 'Bank'").run();
    const harness = createDraftCompletionHarness(database);
    const draft = await createDraft(harness);
    stop = await startPublisher(harness);
    const before = readySnapshot(harness.publisher);

    const partial = await harness.manual.editTransaction({
      transactionId: draft.id,
      changes: { amount: 45_001, note: 'Partial receipt note' },
    });
    assert.equal(partial.id, draft.id);
    assert.equal(partial.status, 'draft');
    assert.equal(partial.amount, 45_001);
    assert.equal(partial.note, 'Partial receipt note');
    const afterPartial = await waitForPublished(
      harness,
      1,
      (snapshot) =>
        snapshot.unloggedDrafts === before.unloggedDrafts - 1 &&
        snapshot.spentThisMonth === before.spentThisMonth + 45_001 &&
        snapshot.balanceTotal === before.balanceTotal - 45_001,
      'Partial save did not publish its exact draft state'
    );

    const retained = await readDrafts(harness);
    assert.equal(retained.length, 1);
    assert.equal(retained[0]?.id, draft.id);
    assert.equal(retained[0]?.amount, 45_001);
    assert.equal(retained[0]?.note, 'Partial receipt note');

    const completionWrites = harness.written.length;
    const completed = await harness.manual.completeDraft({
      transactionId: draft.id,
      amount: 45_001,
      categoryId: spendLeaf(database),
    });
    assert.equal(completed.id, draft.id);
    assert.equal(completed.status, 'complete');
    assert.equal(completed.amount, 45_001);
    await waitForPublished(
      harness,
      completionWrites,
      (snapshot) =>
        snapshot.spentThisMonth === afterPartial.spentThisMonth &&
        snapshot.balanceTotal === afterPartial.balanceTotal &&
        snapshot.unloggedDrafts === afterPartial.unloggedDrafts,
      'Completion did not preserve the already-counted exact amount'
    );
    assert.equal((await readDrafts(harness)).length, 0);
    assert.equal(
      harness.changes.filter((change) => change === 'transactions:completed').length,
      1
    );
  } finally {
    stop?.();
    database.close();
  }
});

test('soft deletion removes unknown and known drafts from the inbox and exact snapshot totals', async () => {
  const database = openMigratedDatabase();
  let stop: (() => void) | undefined;
  try {
    database.prepare("UPDATE accounts SET opening_balance = 1000000 WHERE name = 'Bank'").run();
    const harness = createDraftCompletionHarness(database);
    const unknown = await createDraft(harness, {
      photoKey: 'photos/v1/123e4567-e89b-42d3-a456-426614174002.jpg',
    });
    const known = await createDraft(harness, { amount: 45_001 });
    stop = await startPublisher(harness);
    const before = readySnapshot(harness.publisher);
    assert.equal(before.unloggedDrafts, 1);
    assert.equal(before.spentThisMonth, 45_001);

    let writes = harness.written.length;
    await harness.manual.softDeleteTransaction(unknown.id);
    await waitForPublished(
      harness,
      writes,
      (snapshot) =>
        snapshot.unloggedDrafts === 0 && snapshot.spentThisMonth === 45_001,
      'Unknown deletion did not publish exact totals'
    );
    writes = harness.written.length;
    assert.equal((await readDrafts(harness)).some(({ id }) => id === unknown.id), false);
    const deletedUnknown = await harness.transactions.readTransaction(unknown.id, {
      includeDeleted: true,
    });
    assert.equal(deletedUnknown?.photoKey, unknown.photoKey);
    assert.ok(deletedUnknown?.deletedAt);

    await harness.manual.softDeleteTransaction(known.id);
    await waitForPublished(
      harness,
      writes,
      (snapshot) => snapshot.unloggedDrafts === 0 && snapshot.spentThisMonth === 0,
      'Known deletion did not remove its exact spending'
    );
    assert.equal((await readDrafts(harness)).length, 0);
    const deletedKnown = await harness.transactions.readTransaction(known.id, {
      includeDeleted: true,
    });
    assert.equal(deletedKnown?.photoKey, known.photoKey);
    assert.ok(deletedKnown?.deletedAt);
    assert.equal(
      harness.changes.filter((change) => change === 'transactions:deleted').length,
      2
    );
  } finally {
    stop?.();
    database.close();
  }
});

test('current income maintenance changes only the current config and historical totals stay frozen', async () => {
  const database = openMigratedDatabase();
  let stop: (() => void) | undefined;
  try {
    database.prepare("UPDATE accounts SET opening_balance = 1000000 WHERE name = 'Bank'").run();
    const harness = createDraftCompletionHarness(database);
    const currentIncome = await createDraft(harness, {
      direction: 'income',
      amount: 12_000,
      photoKey: null,
    });
    const historicalIncome = await createDraft(harness, {
      direction: 'income',
      amount: 8_000,
      occurredAt: new Date(2026, 7, 20, 10),
      photoKey: null,
    });
    await harness.monthConfigs.openPeriod({
      period: '2026-08',
      openingBalance: 900_000,
      incomeTotal: 8_000,
      reservedTotal: 120_000,
      horizonDate: '2026-08-31',
    });
    const historicalBefore = monthConfigRow(database, '2026-08');
    stop = await startPublisher(harness);
    const before = readySnapshot(harness.publisher);
    assert.equal(monthConfigRow(database, '2026-09')?.incomeTotal, 12_000);
    assert.equal(before.balanceTotal, 1_020_000);

    let writes = harness.written.length;
    await harness.manual.softDeleteTransaction(currentIncome.id);
    await waitForPublished(
      harness,
      writes,
      (snapshot) => snapshot.balanceTotal === 1_008_000,
      'Current income deletion did not publish the updated balance'
    );
    writes = harness.written.length;
    assert.equal(monthConfigRow(database, '2026-09')?.incomeTotal, 0);
    assert.deepEqual(monthConfigRow(database, '2026-08'), historicalBefore);

    await harness.manual.softDeleteTransaction(historicalIncome.id);
    await waitForPublished(
      harness,
      writes,
      (snapshot) => snapshot.balanceTotal === 1_000_000,
      'Historical income deletion did not publish the updated balance'
    );
    assert.equal(monthConfigRow(database, '2026-09')?.incomeTotal, 0);
    assert.deepEqual(monthConfigRow(database, '2026-08'), historicalBefore);
    assert.equal((await readDrafts(harness)).length, 0);
  } finally {
    stop?.();
    database.close();
  }
});

test('a deletion SQL failure rolls back the row, period income, inbox, and event', async () => {
  const database = openMigratedDatabase();
  try {
    const setupProxy = createProxyDatabase(database);
    const silentNotifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
    const setupTransactions = createTransactionData(
      setupProxy,
      createCategoryData(setupProxy, silentNotifier),
      silentNotifier
    );
    const draft = await setupTransactions.createTransaction({
      accountId: bankId(database),
      direction: 'income',
      status: 'draft',
      amount: 12_000,
      categoryId: null,
      photoKey: completionPhotoKey,
      occurredAt: completionNow,
      quality: null,
      note: null,
      sourceLabel: 'Salary',
    });
    const preparation = createPeriodPreparationData(setupProxy, {
      now: () => completionNow,
      changeNotifier: silentNotifier,
    });
    await preparation.prepareCurrentPeriod(completionNow);
    const beforeConfig = monthConfigRow(database, '2026-09');
    assert.equal(beforeConfig?.incomeTotal, 12_000);

    const events: string[] = [];
    const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
    notifier.subscribe(({ table, mutation }) => events.push(`${table}:${mutation}`));
    const failingProxy = createProxyDatabase(database, {
      afterQuery(query) {
        if (query.toLowerCase().includes('update "transactions"')) {
          throw new Error('simulated deletion SQL failure');
        }
      },
    });
    const manual = createManualTransactionData(
      failingProxy,
      createCategoryData(failingProxy),
      notifier,
      {
        now: () => completionNow,
        runAtomic: createAsyncAtomicRunner(failingProxy),
      }
    );

    await assert.rejects(
      manual.softDeleteTransaction(draft.id),
      /simulated deletion SQL failure|Failed query/i
    );
    const active = await createDraftInboxData(setupProxy).readActiveDrafts();
    assert.equal(active.length, 1);
    assert.equal(active[0]?.id, draft.id);
    assert.equal(monthConfigRow(database, '2026-09')?.incomeTotal, 12_000);
    assert.deepEqual(events, []);
    const retained = await setupTransactions.readTransaction(draft.id, {
      includeDeleted: true,
    });
    assert.equal(retained?.deletedAt, null);
    assert.equal(retained?.photoKey, completionPhotoKey);
  } finally {
    database.close();
  }
});

test('a snapshot failure after deletion retries publication without another transaction write', async () => {
  const database = openMigratedDatabase();
  let stop: (() => void) | undefined;
  try {
    database.prepare("UPDATE accounts SET opening_balance = 1000000 WHERE name = 'Bank'").run();
    const harness = createDraftCompletionHarness(database);
    const draft = await createDraft(harness, { amount: 45_001 });
    stop = await startPublisher(harness);
    harness.setWriteFailure(true);

    await harness.manual.softDeleteTransaction(draft.id);
    await waitFor(
      () => harness.publisher.store.getState().status === 'error',
      'Snapshot publication did not expose the deletion failure'
    );
    assert.equal((await readDrafts(harness)).length, 0);
    const stored = await harness.transactions.readTransaction(draft.id, {
      includeDeleted: true,
    });
    assert.ok(stored?.deletedAt);
    assert.equal(stored?.photoKey, draft.photoKey);
    assert.equal(harness.written.length, 1);
    assert.equal(
      harness.changes.filter((change) => change === 'transactions:deleted').length,
      1
    );

    harness.setWriteFailure(false);
    await harness.publisher.retry();
    assert.equal(harness.publisher.store.getState().status, 'ready');
    assert.equal(harness.written.length, 2);
    assert.equal(readySnapshot(harness.publisher).spentThisMonth, 0);
    assert.equal(
      harness.changes.filter((change) => change === 'transactions:deleted').length,
      1
    );
  } finally {
    stop?.();
    database.close();
  }
});
