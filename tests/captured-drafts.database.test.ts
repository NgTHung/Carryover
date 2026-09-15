import { strict as assert } from 'node:assert';

import { createAsyncAtomicRunner } from '../src/data/atomic';
import { createCapturedDraftData } from '../src/data/captured-drafts';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import {
  createProxyDatabase,
  openMigratedDatabase,
  type ProxyQueryHook,
} from './support/sqlite-proxy';

const now = new Date(2026, 8, 15, 12, 30, 0, 250);
const draftId = '123e4567-e89b-42d3-a456-426614174000';
const secondDraftId = '123e4567-e89b-42d3-a456-426614174002';
const firstPhotoKey = 'photos/v1/123e4567-e89b-42d3-a456-426614174001.jpg';
const secondPhotoKey = 'photos/v1/123e4567-e89b-42d3-a456-426614174003.jpg';

function bankId(database: ReturnType<typeof openMigratedDatabase>): string {
  return (
    database.prepare("SELECT id FROM accounts WHERE name = 'Bank'").get() as { id: string }
  ).id;
}

function cashId(database: ReturnType<typeof openMigratedDatabase>): string {
  return (
    database.prepare("SELECT id FROM accounts WHERE name = 'Cash'").get() as { id: string }
  ).id;
}

function transactionCount(database: ReturnType<typeof openMigratedDatabase>): number {
  return (database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count;
}

function monthConfigCount(database: ReturnType<typeof openMigratedDatabase>): number {
  return (database.prepare('SELECT COUNT(*) AS count FROM month_config').get() as { count: number }).count;
}

function createData(
  database: ReturnType<typeof openMigratedDatabase>,
  changes: string[] = [],
  afterQuery?: ProxyQueryHook
) {
  const proxy = createProxyDatabase(database, { afterQuery });
  const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
  notifier.subscribe(({ table, mutation }) => changes.push(`${table}:${mutation}`));
  return createCapturedDraftData(proxy, notifier, {
    runAtomic: createAsyncAtomicRunner(proxy),
    now: () => now,
  });
}

function captureInput(overrides: Partial<{
  draftId: string;
  photoKey: string;
  amount: string | number | null;
  occurredAt: Date;
}> = {}) {
  return {
    draftId,
    photoKey: firstPhotoKey,
    amount: ' ',
    occurredAt: new Date(2026, 8, 15, 11, 0),
    ...overrides,
  };
}

test('creates known and unknown expense drafts with neutral capture fields', async () => {
  const database = openMigratedDatabase();
  try {
    const changes: string[] = [];
    const data = createData(database, changes);

    const unknown = await data.createCapturedDraft(captureInput());
    assert.equal(unknown.status, 'created');
    assert.equal(unknown.transaction.status, 'draft');
    assert.equal(unknown.transaction.amount, null);
    assert.equal(unknown.transaction.accountId, bankId(database));
    assert.equal(unknown.transaction.direction, 'expense');
    assert.equal(unknown.transaction.adjustmentEffect, null);
    assert.equal(unknown.transaction.categoryId, null);
    assert.equal(unknown.transaction.quality, null);
    assert.deepEqual(unknown.transaction.payer, { kind: 'you' });
    assert.equal(unknown.transaction.photoKey, firstPhotoKey);
    assert.equal(unknown.transaction.note, null);
    assert.equal(unknown.transaction.sourceLabel, null);

    const known = await data.createCapturedDraft(
      captureInput({
        draftId: secondDraftId,
        photoKey: secondPhotoKey,
        amount: '45001',
      })
    );
    assert.equal(known.status, 'created');
    assert.equal(known.transaction.amount, 45_001);
    assert.deepEqual(changes, [
      'month_config:created',
      'transactions:created',
      'transactions:created',
    ]);
    assert.equal(monthConfigCount(database), 1);
    assert.equal(transactionCount(database), 2);
  } finally {
    database.close();
  }
});

test('repeated and concurrent calls return one durable draft and one transaction event', async () => {
  const database = openMigratedDatabase();
  try {
    const changes: string[] = [];
    const data = createData(database, changes);
    const input = captureInput({ amount: '12000' });
    const results = await Promise.all([
      data.createCapturedDraft(input),
      data.createCapturedDraft(input),
      data.createCapturedDraft(input),
    ]);

    assert.deepEqual(results.map(({ status }) => status).sort(), [
      'created',
      'existing',
      'existing',
    ]);
    assert.equal(transactionCount(database), 1);
    assert.deepEqual(changes, ['month_config:created', 'transactions:created']);

    const replay = await data.createCapturedDraft(input);
    assert.equal(replay.status, 'existing');
    assert.deepEqual(changes, ['month_config:created', 'transactions:created']);
  } finally {
    database.close();
  }
});

test('rejects mismatched retries and never mutates the committed row', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createData(database);
    await data.createCapturedDraft(captureInput({ amount: '12000' }));

    await assert.rejects(
      data.createCapturedDraft(captureInput({ amount: '12001' })),
      /conflicts/i
    );
    await assert.rejects(
      data.createCapturedDraft(captureInput({ photoKey: secondPhotoKey })),
      /conflicts/i
    );
    await assert.rejects(
      data.createCapturedDraft(
        captureInput({ occurredAt: new Date(2026, 8, 15, 11, 1) })
      ),
      /conflicts/i
    );
    assert.equal(transactionCount(database), 1);

    database.prepare('UPDATE transactions SET account_id = ? WHERE id = ?').run(
      cashId(database),
      draftId
    );
    await assert.rejects(data.createCapturedDraft(captureInput({ amount: '12000' })), /conflicts/i);

    database.prepare('UPDATE transactions SET account_id = ?, direction = ? WHERE id = ?').run(
      bankId(database),
      'income',
      draftId
    );
    await assert.rejects(data.createCapturedDraft(captureInput({ amount: '12000' })), /conflicts/i);

    database.prepare('UPDATE transactions SET direction = ?, status = ? WHERE id = ?').run(
      'expense',
      'complete',
      draftId
    );
    await assert.rejects(data.createCapturedDraft(captureInput({ amount: '12000' })), /conflicts/i);

    database.prepare('UPDATE transactions SET status = ?, deleted_at = ? WHERE id = ?').run(
      'draft',
      now.getTime(),
      draftId
    );
    await assert.rejects(data.createCapturedDraft(captureInput({ amount: '12000' })), /conflicts/i);
    assert.equal(transactionCount(database), 1);
  } finally {
    database.close();
  }
});

test('prepares the current period before the first capture and rejects a future local date', async () => {
  const database = openMigratedDatabase();
  try {
    const data = createData(database);
    const laterToday = await data.createCapturedDraft(
      captureInput({ occurredAt: new Date(2026, 8, 15, 23, 59) })
    );
    assert.equal(laterToday.transaction.occurredAt.getHours(), 23);
    assert.equal(monthConfigCount(database), 1);

    await assert.rejects(
      data.createCapturedDraft(
        captureInput({
          draftId: secondDraftId,
          photoKey: secondPhotoKey,
          occurredAt: new Date(2026, 8, 16, 0, 1),
        })
      ),
      /future/i
    );
    assert.equal(transactionCount(database), 1);
  } finally {
    database.close();
  }
});

test('requires exactly one active default account without partial writes', async () => {
  const missing = openMigratedDatabase();
  try {
    missing.prepare('UPDATE accounts SET is_default = 0').run();
    const changes: string[] = [];
    const data = createData(missing, changes);
    await assert.rejects(data.createCapturedDraft(captureInput()), /exactly one active default/i);
    assert.equal(transactionCount(missing), 0);
    assert.equal(monthConfigCount(missing), 0);
    assert.deepEqual(changes, []);
  } finally {
    missing.close();
  }

  const duplicate = openMigratedDatabase();
  try {
    duplicate.prepare("UPDATE accounts SET is_default = 1 WHERE name = 'Cash'").run();
    const changes: string[] = [];
    const data = createData(duplicate, changes);
    await assert.rejects(data.createCapturedDraft(captureInput()), /exactly one active default/i);
    assert.equal(transactionCount(duplicate), 0);
    assert.equal(monthConfigCount(duplicate), 0);
    assert.deepEqual(changes, []);
  } finally {
    duplicate.close();
  }
});

test('rolls back period preparation and suppresses notifications when insertion fails', async () => {
  const database = openMigratedDatabase();
  try {
    const changes: string[] = [];
    const data = createData(
      database,
      changes,
      async (query) => {
        if (query.toLowerCase().includes('insert into "transactions"')) {
          throw new Error('injected capture insert failure');
        }
      }
    );

    await assert.rejects(data.createCapturedDraft(captureInput()), /failed query.*transactions/i);
    assert.equal(transactionCount(database), 0);
    assert.equal(monthConfigCount(database), 0);
    assert.deepEqual(changes, []);
  } finally {
    database.close();
  }
});
