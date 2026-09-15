import { strict as assert } from 'node:assert';

import { MAX_VND_AMOUNT } from '../src/money/currency';
import { createAccountData } from '../src/data/accounts';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const now = new Date(2026, 8, 15, 12);

type IdRow = { id: unknown };
type AccountRow = {
  id: unknown;
  name: unknown;
  kind: unknown;
  is_default: unknown;
  opening_balance: unknown;
  updated_at: unknown;
};

function accountId(
  database: ReturnType<typeof openMigratedDatabase>,
  name: string
): string {
  const row = database
    .prepare('SELECT id FROM accounts WHERE name = ? AND deleted_at IS NULL')
    .get(name) as IdRow | undefined;
  if (!row || typeof row.id !== 'string') {
    throw new Error(`Missing active account ${name}`);
  }
  return row.id;
}

function accountRow(
  database: ReturnType<typeof openMigratedDatabase>,
  accountIdValue: string
): AccountRow {
  return database
    .prepare(
      'SELECT id, name, kind, is_default, opening_balance, updated_at FROM accounts WHERE id = ?'
    )
    .get(accountIdValue) as AccountRow;
}

function monthConfigCount(
  database: ReturnType<typeof openMigratedDatabase>
): number {
  return (
    database
      .prepare('SELECT COUNT(*) AS count FROM month_config')
      .get() as { count: number }
  ).count;
}

test('details edits save both fields atomically and preserve account identity', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const cashId = accountId(database, 'Cash');
    const events: string[] = [];
    let committedName: unknown;
    const notifier = createLedgerChangeNotifier();
    notifier.subscribe(({ table, mutation }) => {
      events.push(`${table}:${mutation}`);
      if (table === 'accounts') {
        committedName = accountRow(database, bankId).name;
      }
    });
    const data = createAccountData(
      createProxyDatabase(database),
      notifier,
      { now: () => now }
    );

    await data.editAccountDetails({
      accountId: bankId,
      name: '  Main bank  ',
      openingBalance: 1_200_000,
    });

    const bank = accountRow(database, bankId);
    const cash = accountRow(database, cashId);
    assert.deepEqual(
      {
        id: bank.id,
        name: bank.name,
        kind: bank.kind,
        isDefault: bank.is_default,
        openingBalance: bank.opening_balance,
      },
      {
        id: bankId,
        name: 'Main bank',
        kind: 'bank',
        isDefault: 1,
        openingBalance: 1_200_000,
      }
    );
    assert.deepEqual(
      { id: cash.id, name: cash.name, kind: cash.kind, isDefault: cash.is_default },
      { id: cashId, name: 'Cash', kind: 'cash', isDefault: 0 }
    );
    assert.equal(committedName, 'Main bank');
    assert.deepEqual(events, ['accounts:edited', 'month_config:created']);
    assert.equal(monthConfigCount(database), 1);
  } finally {
    database.close();
  }
});

test('normalized unchanged details are a silent no-op', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const notifier = createLedgerChangeNotifier();
    const events: string[] = [];
    notifier.subscribe(({ table, mutation }) => {
      events.push(`${table}:${mutation}`);
    });
    const data = createAccountData(
      createProxyDatabase(database),
      notifier,
      { now: () => now }
    );
    await data.editAccountDetails({
      accountId: bankId,
      name: 'Bank',
      openingBalance: 1_000_000,
    });
    const before = accountRow(database, bankId);
    const beforeEvents = events.length;
    const beforeConfigCount = monthConfigCount(database);

    await data.editAccountDetails({
      accountId: bankId,
      name: '  Bank  ',
      openingBalance: 1_000_000,
    });

    const after = accountRow(database, bankId);
    assert.equal(after.updated_at, before.updated_at);
    assert.equal(events.length, beforeEvents);
    assert.equal(monthConfigCount(database), beforeConfigCount);
  } finally {
    database.close();
  }
});

test('invalid and deleted account edits write neither account nor period rows', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const data = createAccountData(
      createProxyDatabase(database),
      undefined,
      { now: () => now }
    );
    await assert.rejects(
      data.editAccountDetails({
        accountId: bankId,
        name: 'Renamed',
        openingBalance: -1,
      })
    );
    assert.equal(accountRow(database, bankId).name, 'Bank');
    assert.equal(monthConfigCount(database), 0);

    database
      .prepare('UPDATE accounts SET deleted_at = ? WHERE id = ?')
      .run(now.getTime(), bankId);
    await assert.rejects(
      data.editAccountDetails({
        accountId: bankId,
        name: 'Renamed',
        openingBalance: 1_000,
      }),
      /not found/i
    );
    assert.equal(monthConfigCount(database), 0);
  } finally {
    database.close();
  }
});

test('a failed account write rolls back period preparation and emits no mutation', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const events: string[] = [];
    const notifier = createLedgerChangeNotifier();
    notifier.subscribe(({ table, mutation }) => {
      events.push(`${table}:${mutation}`);
    });
    const proxy = createProxyDatabase(database, {
      afterQuery(query) {
        if (query.toLowerCase().includes('update "accounts"')) {
          throw new Error('simulated account write failure');
        }
      },
    });
    const data = createAccountData(proxy, notifier, { now: () => now });

    await assert.rejects(
      data.editAccountDetails({
        accountId: bankId,
        name: 'Renamed',
        openingBalance: 1_000,
      }),
      /Failed query|simulated account write failure/i
    );
    assert.equal(accountRow(database, bankId).name, 'Bank');
    assert.equal(accountRow(database, bankId).opening_balance, 0);
    assert.equal(monthConfigCount(database), 0);
    assert.deepEqual(events, []);
  } finally {
    database.close();
  }
});

test('a stale account timestamp rejects the write without committing preparation', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    let changed = false;
    const proxy = createProxyDatabase(database, {
      afterQuery(query, _params, method) {
        if (
          !changed &&
          method === 'get' &&
          query.toLowerCase().includes('from "accounts"')
        ) {
          changed = true;
          database
            .prepare('UPDATE accounts SET updated_at = updated_at + 1 WHERE id = ?')
            .run(bankId);
        }
      },
    });
    const data = createAccountData(proxy, undefined, { now: () => now });

    await assert.rejects(
      data.editAccountDetails({
        accountId: bankId,
        name: 'Renamed',
        openingBalance: 1_000,
      }),
      /changed during account edit/i
    );
    assert.equal(changed, true);
    assert.equal(accountRow(database, bankId).name, 'Bank');
    assert.equal(monthConfigCount(database), 0);
  } finally {
    database.close();
  }
});

test('an edit rejects an unsafe combined balance and rolls back both tables', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    database
      .prepare("UPDATE accounts SET opening_balance = ? WHERE name = 'Cash'")
      .run(MAX_VND_AMOUNT);
    const data = createAccountData(
      createProxyDatabase(database),
      undefined,
      { now: () => now }
    );

    await assert.rejects(
      data.editAccountDetails({
        accountId: bankId,
        name: 'Renamed',
        openingBalance: MAX_VND_AMOUNT,
      }),
      /combined account balance|safe VND/i
    );
    assert.equal(accountRow(database, bankId).name, 'Bank');
    assert.equal(accountRow(database, bankId).opening_balance, 0);
    assert.equal(monthConfigCount(database), 0);
  } finally {
    database.close();
  }
});
