import { strict as assert } from 'node:assert';

import { readBudgetInput } from '../src/budget/snapshot-source';
import {
  createSnapshotPublisher,
  startSnapshotPublisher,
} from '../src/budget/snapshot-publisher';
import { createAccountData } from '../src/data/accounts';
import { createCategoryData } from '../src/data/categories';
import { createCommitmentData } from '../src/data/commitments';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createMonthConfigData } from '../src/data/month-config';
import { createPeriodPreparationData } from '../src/data/period-preparation';
import { createShareData } from '../src/data/shares';
import { createManualTransactionData } from '../src/data/manual-transactions';
import { createTransactionData } from '../src/data/transactions';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const now = new Date(2026, 8, 15, 12);

type IdRow = { id: string };

function idFor(database: ReturnType<typeof openMigratedDatabase>, query: string): string {
  const row = database.prepare(query).get() as IdRow | undefined;
  if (row === undefined) throw new Error(`Missing id for ${query}`);
  return row.id;
}

test('startup preparation reaches a ready snapshot without a seeded current config', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const preparation = createPeriodPreparationData(proxy, { now: () => now });
    const publisher = createSnapshotPublisher({
      now: () => now,
      readInput: async (at) => {
        await preparation.prepareCurrentPeriod(at);
        return readBudgetInput(
          {
            accounts: createAccountData(proxy),
            commitments: createCommitmentData(proxy),
            monthConfig: createMonthConfigData(proxy),
            shares: createShareData(proxy),
            transactions: createTransactionData(proxy, createCategoryData(proxy)),
          },
          at
        );
      },
      writer: () => undefined,
    });

    await publisher.refresh();
    assert.equal(publisher.store.getState().status, 'ready');
    assert.equal(
      (database.prepare("SELECT COUNT(*) AS count FROM month_config WHERE period = '2026-09'").get() as { count: number }).count,
      1
    );
  } finally {
    database.close();
  }
});

test('a committed income survives shared-storage failure and retry without reinsertion', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const notifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
    const silentNotifier = createLedgerChangeNotifier({ onListenerError: () => undefined });
    const preparation = createPeriodPreparationData(proxy, {
      now: () => now,
      changeNotifier: silentNotifier,
    });
    const manual = createManualTransactionData(
      proxy,
      createCategoryData(proxy, silentNotifier),
      notifier,
      { now: () => now }
    );
    const reads = {
      accounts: createAccountData(proxy, silentNotifier),
      commitments: createCommitmentData(proxy, silentNotifier),
      monthConfig: createMonthConfigData(proxy, silentNotifier),
      shares: createShareData(proxy),
      transactions: createTransactionData(proxy, createCategoryData(proxy, silentNotifier), silentNotifier),
    };
    let failWrite = false;
    let readCount = 0;
    let writeCount = 0;
    const publisher = createSnapshotPublisher({
      now: () => now,
      readInput: async (at) => {
        readCount += 1;
        await preparation.prepareCurrentPeriod(at);
        return readBudgetInput(reads, at);
      },
      writer: () => {
        writeCount += 1;
        if (failWrite) throw new Error('shared storage unavailable');
      },
    });
    const stop = startSnapshotPublisher(publisher, notifier);
    await publisher.refresh();
    assert.equal(publisher.store.getState().status, 'ready');

    failWrite = true;
    await manual.createTransaction({
      accountId: idFor(database, "SELECT id FROM accounts WHERE name = 'Bank'"),
      direction: 'income',
      status: 'complete',
      amount: 800,
      occurredAt: now,
    });
    await assert.rejects(publisher.refresh(), /shared storage unavailable/i);
    assert.equal(
      (database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count,
      1
    );
    assert.equal(
      (database.prepare("SELECT income_total AS incomeTotal FROM month_config WHERE period = '2026-09'").get() as { incomeTotal: number }).incomeTotal,
      800
    );

    failWrite = false;
    await publisher.retry();
    assert.equal(publisher.store.getState().status, 'ready');
    assert.equal(
      (database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count,
      1
    );
    assert.ok(readCount >= 3);
    assert.ok(writeCount >= 3);
    stop();
  } finally {
    database.close();
  }
});
