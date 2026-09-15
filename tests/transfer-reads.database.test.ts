import { strict as assert } from 'node:assert';

import { createAccountData } from '../src/data/accounts';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';
import { createTransactionListData } from '../src/data/transaction-list';

const occurredAt = new Date(2026, 0, 12, 10);

function idFor(
  database: ReturnType<typeof openMigratedDatabase>,
  kind: 'bank' | 'cash'
): string {
  const row = database
    .prepare('SELECT id FROM accounts WHERE kind = ? AND deleted_at IS NULL')
    .get(kind) as { id: unknown } | undefined;
  if (row === undefined || typeof row.id !== 'string') {
    throw new Error(`Missing ${kind} account`);
  }
  return row.id;
}

test('the dedicated list and detail readers agree and retain renamed historical labels', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const accountData = createAccountData(proxy, undefined, {
      now: () => new Date(2026, 0, 13, 10),
    });
    const listData = createTransactionListData(proxy);
    const bankId = idFor(database, 'bank');
    const cashId = idFor(database, 'cash');

    await accountData.recordTransfer({
      fromAccountId: bankId,
      toAccountId: cashId,
      amount: 200_000,
      occurredAt,
    });
    const transfer = database
      .prepare('SELECT id FROM transfers WHERE deleted_at IS NULL')
      .get() as { id: string };

    const beforeRename = await accountData.readTransfer(transfer.id);
    assert.equal(beforeRename?.fromAccount.name, 'Bank');
    assert.equal(beforeRename?.toAccount.name, 'Cash');
    assert.equal(beforeRename?.transfer.amount, 200_000);
    assert.equal(beforeRename?.transfer.occurredAt.getTime(), occurredAt.getTime());

    const listRows = await listData.readTransactionList({
      period: '2026-01',
      categoryId: null,
      accountId: bankId,
      quality: null,
    });
    const listTransfer = listRows.find(
      (row) => row.kind === 'transfer' && row.source === 'transfers'
    );
    assert.equal(listTransfer?.kind, 'transfer');
    if (listTransfer?.kind === 'transfer' && listTransfer.source === 'transfers') {
      assert.equal(listTransfer.transfer.id, transfer.id);
      assert.equal(listTransfer.fromAccount.name, beforeRename?.fromAccount.name);
      assert.equal(listTransfer.toAccount.name, beforeRename?.toAccount.name);
    }

    database.prepare('UPDATE accounts SET name = ? WHERE id = ?').run('Renamed bank', bankId);
    database.prepare('UPDATE accounts SET deleted_at = ? WHERE id = ?').run(occurredAt.getTime(), cashId);
    const historical = await accountData.readTransfer(transfer.id);
    assert.equal(historical?.fromAccount.name, 'Renamed bank');
    assert.equal(historical?.toAccount.name, 'Cash');
    assert.equal(historical?.toAccount.id, cashId);
  } finally {
    database.close();
  }
});

test('missing and soft-deleted dedicated transfers are unavailable', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const data = createAccountData(proxy, undefined, {
      now: () => new Date(2026, 0, 13, 10),
    });
    const bankId = idFor(database, 'bank');
    const cashId = idFor(database, 'cash');
    await data.recordTransfer({
      fromAccountId: bankId,
      toAccountId: cashId,
      amount: 1,
      occurredAt,
    });
    const transfer = database.prepare('SELECT id FROM transfers').get() as { id: string };

    assert.equal(
      await data.readTransfer('33333333-3333-4333-8333-333333333333'),
      undefined
    );
    database
      .prepare('UPDATE transfers SET deleted_at = ? WHERE id = ?')
      .run(new Date(2026, 0, 14, 10).getTime(), transfer.id);
    assert.equal(await data.readTransfer(transfer.id), undefined);
  } finally {
    database.close();
  }
});

test('malformed transfer IDs are rejected before the database is read', async () => {
  const database = openMigratedDatabase();
  try {
    let queries = 0;
    const proxy = createProxyDatabase(database, {
      afterQuery() {
        queries += 1;
      },
    });
    const data = createAccountData(proxy);
    await assert.rejects(data.readTransfer('not-a-uuid'));
    assert.equal(queries, 0);
  } finally {
    database.close();
  }
});
