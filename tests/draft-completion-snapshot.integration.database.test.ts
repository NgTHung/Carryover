import { strict as assert } from 'node:assert';

import { MAX_VND_AMOUNT } from '../src/money/currency';
import {
  createSnapshotPublisher,
  startSnapshotPublisher,
} from '../src/budget/snapshot-publisher';
import { createCategoryData } from '../src/data/categories';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createManualTransactionData } from '../src/data/manual-transactions';
import { createAsyncAtomicRunner, type AtomicTransactionRunner, type LedgerDatabase } from '../src/data/atomic';
import { createTransactionData } from '../src/data/transactions';
import {
  bankId,
  completionNow,
  completionPhotoKey,
  countRows,
  createDraftCompletionHarness,
  financialSnapshot,
  monthConfigRow,
  readySnapshot,
  reserveLeaf,
  spendLeaf,
  waitFor,
} from './support/draft-completion-fixture';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

async function startPublisher(
  harness: ReturnType<typeof createDraftCompletionHarness>
): Promise<() => void> {
  const stop = startSnapshotPublisher(harness.publisher, harness.notifier);
  await waitFor(
    () => harness.written.length === 1 && harness.publisher.store.getState().status === 'ready',
    'Initial snapshot did not publish'
  );
  return stop;
}

async function createDraft(
  harness: ReturnType<typeof createDraftCompletionHarness>,
  input: {
    direction?: 'expense' | 'income';
    amount?: number | null;
    categoryId?: string | null;
    occurredAt?: Date;
  } = {}
) {
  return harness.transactions.createTransaction({
    accountId: bankId(harness.database),
    direction: input.direction ?? 'expense',
    status: 'draft',
    amount: input.amount ?? null,
    categoryId: input.categoryId ?? null,
    photoKey: completionPhotoKey,
    occurredAt: input.occurredAt ?? completionNow,
    quality: null,
    note: null,
    sourceLabel: null,
  });
}

test('completing an unknown expense updates the same row and publishes exact budget changes', async () => {
  const database = openMigratedDatabase();
  let stop: (() => void) | undefined;
  try {
    database.prepare("UPDATE accounts SET opening_balance = 1000000 WHERE name = 'Bank'").run();
    const harness = createDraftCompletionHarness(database);
    const draft = await createDraft(harness);
    stop = await startPublisher(harness);
    const before = readySnapshot(harness.publisher);

    const completed = await harness.manual.completeDraft({
      transactionId: draft.id,
      amount: '45001',
      categoryId: spendLeaf(database),
    });
    await waitFor(() => harness.written.length === 2, 'Completion did not publish');
    const after = readySnapshot(harness.publisher);

    assert.equal(completed.id, draft.id);
    assert.equal(completed.status, 'complete');
    assert.equal(completed.amount, 45_001);
    assert.equal(completed.categoryId, spendLeaf(database));
    assert.equal(completed.photoKey, completionPhotoKey);
    assert.equal(completed.quality, null);
    assert.equal(completed.accountId, draft.accountId);
    assert.equal(completed.occurredAt.getTime(), draft.occurredAt.getTime());
    assert.equal(after.unloggedDrafts, before.unloggedDrafts - 1);
    assert.equal(after.spentThisMonth, before.spentThisMonth + 45_001);
    assert.equal(after.balanceTotal, before.balanceTotal - 45_001);
    assert.equal(harness.changes.filter((change) => change === 'transactions:completed').length, 1);
    assert.equal(harness.written[1], after);
  } finally {
    stop?.();
    database.close();
  }
});

test('a known amount draft remains unlogged-free and charges spending exactly once on completion', async () => {
  const database = openMigratedDatabase();
  let stop: (() => void) | undefined;
  try {
    database.prepare("UPDATE accounts SET opening_balance = 1000000 WHERE name = 'Bank'").run();
    const harness = createDraftCompletionHarness(database);
    const draft = await createDraft(harness, {
      amount: 45_001,
      categoryId: spendLeaf(database),
    });
    stop = await startPublisher(harness);
    const before = readySnapshot(harness.publisher);

    await harness.manual.completeDraft({
      transactionId: draft.id,
      amount: 45_001,
      categoryId: spendLeaf(database),
    });
    await waitFor(() => harness.written.length === 2, 'Known draft completion did not publish');
    const after = readySnapshot(harness.publisher);

    assert.equal(before.unloggedDrafts, 0);
    assert.equal(after.unloggedDrafts, before.unloggedDrafts);
    assert.equal(after.spentThisMonth, before.spentThisMonth);
    assert.equal(after.balanceTotal, before.balanceTotal);
    assert.equal(countRows(database, 'transactions'), 1);
  } finally {
    stop?.();
    database.close();
  }
});

test('changing a current expense draft to income removes spending and maintains income once', async () => {
  const database = openMigratedDatabase();
  let stop: (() => void) | undefined;
  try {
    database.prepare("UPDATE accounts SET opening_balance = 1000000 WHERE name = 'Bank'").run();
    const harness = createDraftCompletionHarness(database);
    const draft = await createDraft(harness);
    stop = await startPublisher(harness);
    const before = readySnapshot(harness.publisher);

    const completed = await harness.manual.completeDraft({
      transactionId: draft.id,
      amount: 45_001,
      categoryId: null,
      changes: { direction: 'income', sourceLabel: '  Salary  ' },
    });
    await waitFor(
      () =>
        harness.written.length >= 2 &&
        harness.publisher.store.getState().status === 'ready',
      'Income completion did not publish'
    );
    const after = readySnapshot(harness.publisher);

    assert.equal(completed.direction, 'income');
    assert.equal(completed.categoryId, null);
    assert.equal(completed.sourceLabel, 'Salary');
    assert.equal(after.spentThisMonth, before.spentThisMonth);
    assert.equal(after.unloggedDrafts, before.unloggedDrafts - 1);
    assert.equal(after.balanceTotal, before.balanceTotal + 45_001);
    assert.equal(monthConfigRow(database, '2026-09')?.incomeTotal, 45_001);
  } finally {
    stop?.();
    database.close();
  }
});

test('changing an income draft to an expense clears current income and charges the spend leaf', async () => {
  const database = openMigratedDatabase();
  let stop: (() => void) | undefined;
  try {
    database.prepare("UPDATE accounts SET opening_balance = 1000000 WHERE name = 'Bank'").run();
    const harness = createDraftCompletionHarness(database);
    const draft = await createDraft(harness, { direction: 'income' });
    stop = await startPublisher(harness);
    const before = readySnapshot(harness.publisher);

    const completed = await harness.manual.completeDraft({
      transactionId: draft.id,
      amount: 45_001,
      categoryId: spendLeaf(database),
      changes: { direction: 'expense' },
    });
    await waitFor(() => harness.written.length === 2, 'Expense completion did not publish');
    const after = readySnapshot(harness.publisher);

    assert.equal(completed.direction, 'expense');
    assert.equal(completed.categoryId, spendLeaf(database));
    assert.equal(after.spentThisMonth, before.spentThisMonth + 45_001);
    assert.equal(after.balanceTotal, before.balanceTotal - 45_001);
    assert.equal(monthConfigRow(database, '2026-09')?.incomeTotal, 0);
  } finally {
    stop?.();
    database.close();
  }
});

test('first completion after rollover prepares the current period in the same transaction', async () => {
  const database = openMigratedDatabase();
  try {
    const harness = createDraftCompletionHarness(database);
    const draft = await createDraft(harness);
    const completed = await harness.manual.completeDraft({
      transactionId: draft.id,
      amount: 45_001,
      categoryId: spendLeaf(database),
    });

    assert.equal(completed.status, 'complete');
    assert.equal(countRows(database, 'month_config'), 1);
    assert.equal(monthConfigRow(database, '2026-09')?.incomeTotal, 0);
    assert.deepEqual(harness.changes, [
      'month_config:created',
      'transactions:completed',
    ]);
  } finally {
    database.close();
  }
});

test('historical completion leaves the stored past-period snapshot unchanged', async () => {
  const database = openMigratedDatabase();
  let stop: (() => void) | undefined;
  try {
    const harness = createDraftCompletionHarness(database);
    const past = await harness.monthConfigs.openPeriod({
      period: '2026-08',
      openingBalance: 900_000,
      incomeTotal: 100_000,
      reservedTotal: 250_000,
      horizonDate: '2026-08-25',
    });
    const draft = await createDraft(harness, {
      occurredAt: new Date(2026, 7, 20, 10),
    });
    const before = monthConfigRow(database, past.period);
    stop = await startPublisher(harness);

    await harness.manual.completeDraft({
      transactionId: draft.id,
      amount: 45_001,
      categoryId: spendLeaf(database),
      changes: { occurredAt: new Date(2026, 7, 21, 10) },
    });

    assert.deepEqual(monthConfigRow(database, past.period), before);
    assert.deepEqual(await harness.monthConfigs.readMonthConfig(past.period), past);
  } finally {
    stop?.();
    database.close();
  }
});

test('a reserve leaf keeps the existing reserve matcher and ordinary spending semantics', async () => {
  const database = openMigratedDatabase();
  let stop: (() => void) | undefined;
  try {
    const harness = createDraftCompletionHarness(database);
    await harness.commitments.createCommitment({
      name: 'September rent',
      amount: 45_001,
      dueDay: 5,
      categoryId: reserveLeaf(database),
    });
    const draft = await createDraft(harness);
    stop = await startPublisher(harness);
    assert.equal(readySnapshot(harness.publisher).reservedUnpaid, 45_001);

    await harness.manual.completeDraft({
      transactionId: draft.id,
      amount: 45_001,
      categoryId: reserveLeaf(database),
    });
    await waitFor(() => harness.written.length === 2, 'Reserve completion did not publish');
    const after = readySnapshot(harness.publisher);

    assert.equal(after.reservedUnpaid, 0);
    assert.equal(after.spentThisMonth, 45_001);
  } finally {
    stop?.();
    database.close();
  }
});

test('SQL failure rolls back promotion, period preparation, and its completion event', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const silentNotifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
    const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
    const changes: string[] = [];
    notifier.subscribe(({ table, mutation }) => changes.push(`${table}:${mutation}`));
    const categories = createCategoryData(proxy, silentNotifier);
    const transactions = createTransactionData(
      proxy,
      categories,
      silentNotifier
    );
    const draft = await transactions.createTransaction({
      accountId: bankId(database),
      direction: 'expense',
      status: 'draft',
      amount: null,
      categoryId: null,
      photoKey: completionPhotoKey,
      occurredAt: completionNow,
    });
    const runAtomic: AtomicTransactionRunner<'async'> = async <T>(
      operation: (transactionDb: LedgerDatabase<'async'>) => Promise<T>
    ) => proxy.transaction(async (transactionDb) => {
      await operation(transactionDb);
      throw new Error('simulated SQL failure');
    });
    const manual = createManualTransactionData(proxy, categories, notifier, {
      now: () => completionNow,
      runAtomic,
    });

    await assert.rejects(
      manual.completeDraft({
        transactionId: draft.id,
        amount: 45_001,
        categoryId: spendLeaf(database),
      }),
      /simulated SQL failure/i
    );
    const unchanged = await transactions.readTransaction(draft.id);
    assert.equal(unchanged?.status, 'draft');
    assert.equal(unchanged?.photoKey, completionPhotoKey);
    assert.equal(countRows(database, 'month_config'), 0);
    assert.deepEqual(changes, []);
  } finally {
    database.close();
  }
});

test('income overflow rolls back completion and leaves the retained row available', async () => {
  const database = openMigratedDatabase();
  try {
    const harness = createDraftCompletionHarness(database);
    await harness.transactions.createTransaction({
      accountId: bankId(harness.database),
      direction: 'income',
      status: 'complete',
      amount: MAX_VND_AMOUNT,
      categoryId: null,
      photoKey: null,
      occurredAt: completionNow,
    });
    const draft = await createDraft(harness, { direction: 'income' });

    await assert.rejects(
      harness.manual.completeDraft({
        transactionId: draft.id,
        amount: 1,
        categoryId: null,
      }),
      /safe VND|safe integer|overflow/i
    );
    const unchanged = await harness.transactions.readTransaction(draft.id);
    assert.equal(unchanged?.status, 'draft');
    assert.equal(unchanged?.photoKey, completionPhotoKey);
    assert.equal(countRows(database, 'month_config'), 0);
    assert.equal(harness.changes.includes('transactions:completed'), false);
  } finally {
    database.close();
  }
});

test('a snapshot publication failure leaves one complete row and retries publication only', async () => {
  const database = openMigratedDatabase();
  let stop: (() => void) | undefined;
  try {
    const harness = createDraftCompletionHarness(database);
    const draft = await createDraft(harness);
    stop = await startPublisher(harness);
    harness.setWriteFailure(true);

    await harness.manual.completeDraft({
      transactionId: draft.id,
      amount: 45_001,
      categoryId: spendLeaf(database),
    });
    await waitFor(
      () => harness.publisher.store.getState().status === 'error',
      'Snapshot publication did not expose its failure'
    );
    assert.equal(countRows(database, 'transactions'), 1);
    assert.equal((await harness.transactions.readTransaction(draft.id))?.status, 'complete');
    assert.equal(harness.written.length, 1);
    assert.equal(harness.changes.filter((change) => change === 'transactions:completed').length, 1);

    harness.setWriteFailure(false);
    await harness.publisher.retry();
    const retried = harness.written[1];
    assert.ok(retried);
    assert.deepEqual(financialSnapshot(retried), financialSnapshot(readySnapshot(harness.publisher)));
    assert.equal(countRows(database, 'transactions'), 1);
    assert.equal(harness.changes.filter((change) => change === 'transactions:completed').length, 1);
  } finally {
    stop?.();
    database.close();
  }
});
