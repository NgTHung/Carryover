import { strict as assert } from 'node:assert';

import { MAX_VND_AMOUNT } from '../src/money/currency';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createAccountData } from '../src/data/accounts';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

const occurredAt = new Date(2025, 0, 1, 12);
const submittedAt = new Date(2025, 0, 2, 12);

function accountIds(database: ReturnType<typeof openMigratedDatabase>): {
  bankId: string;
  cashId: string;
} {
  const rows = database
    .prepare("SELECT id, kind FROM accounts WHERE deleted_at IS NULL")
    .all() as Array<{ id: unknown; kind: unknown }>;
  const bankId = rows.find((row) => row.kind === 'bank')?.id;
  const cashId = rows.find((row) => row.kind === 'cash')?.id;
  if (typeof bankId !== 'string' || typeof cashId !== 'string') {
    throw new Error('Expected seeded bank and cash accounts');
  }
  return { bankId, cashId };
}

function setOpeningBalances(
  database: ReturnType<typeof openMigratedDatabase>,
  bank: number,
  cash: number
): void {
  database
    .prepare('UPDATE accounts SET opening_balance = CASE kind WHEN \'bank\' THEN ? ELSE ? END')
    .run(bank, cash);
}

function count(database: ReturnType<typeof openMigratedDatabase>, table: string): number {
  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: unknown };
  if (typeof row.count !== 'number') throw new Error(`Invalid count for ${table}`);
  return row.count;
}

test('records a transfer atomically and notifies after both effects are committed', async () => {
  const database = openMigratedDatabase();
  try {
    const { bankId, cashId } = accountIds(database);
    setOpeningBalances(database, 950_000, 250_000);
    const notifier = createLedgerChangeNotifier();
    const observed: Array<{ transferCount: number; bank: number; cash: number }> = [];
    const data = createAccountData(createProxyDatabase(database), notifier, {
      now: () => submittedAt,
    });
    notifier.subscribe((change) => {
      if (change.table !== 'transfers') return;
      const rows = database
        .prepare('SELECT opening_balance, kind FROM accounts WHERE deleted_at IS NULL ORDER BY kind')
        .all() as Array<{ opening_balance: unknown; kind: unknown }>;
      const balances = rows.map((row) => Number(row.opening_balance));
      observed.push({
        transferCount: count(database, 'transfers'),
        bank: balances[0] ?? -1,
        cash: balances[1] ?? -1,
      });
    });

    await data.recordTransfer({
      fromAccountId: bankId,
      toAccountId: cashId,
      amount: 200_000,
      occurredAt,
    });

    const balances = await data.readAccountBalances();
    assert.equal(balances.find((account) => account.accountId === bankId)?.balance, 750_000);
    assert.equal(balances.find((account) => account.accountId === cashId)?.balance, 450_000);
    assert.equal(count(database, 'transactions'), 0);
    assert.equal(count(database, 'transfers'), 1);
    assert.deepEqual(observed, [{ transferCount: 1, bank: 950_000, cash: 250_000 }]);
  } finally {
    database.close();
  }
});

test('records one dong in either direction and allows the source to go negative', async () => {
  const database = openMigratedDatabase();
  try {
    const { bankId, cashId } = accountIds(database);
    setOpeningBalances(database, 0, 0);
    const data = createAccountData(createProxyDatabase(database), undefined, {
      now: () => submittedAt,
    });

    await data.recordTransfer({
      fromAccountId: bankId,
      toAccountId: cashId,
      amount: 1,
      occurredAt,
    });
    await data.recordTransfer({
      fromAccountId: cashId,
      toAccountId: bankId,
      amount: 1,
      occurredAt,
    });

    const balances = await data.readAccountBalances();
    assert.equal(balances.find((account) => account.accountId === bankId)?.balance, 0);
    assert.equal(balances.find((account) => account.accountId === cashId)?.balance, 0);
    assert.equal(count(database, 'transfers'), 2);
  } finally {
    database.close();
  }
});

test('rejects invalid, future, same-account, and inactive-account writes before mutation', async () => {
  const database = openMigratedDatabase();
  try {
    const { bankId, cashId } = accountIds(database);
    const notifier = createLedgerChangeNotifier();
    let notifications = 0;
    notifier.subscribe(() => {
      notifications += 1;
    });
    const data = createAccountData(createProxyDatabase(database), notifier, {
      now: () => submittedAt,
    });
    const valid = { fromAccountId: bankId, toAccountId: cashId, amount: 1, occurredAt };

    for (const input of [
      { ...valid, amount: 0 },
      { ...valid, amount: -1 },
      { ...valid, amount: 1.5 },
      { ...valid, amount: '1' },
      { ...valid, amount: Number.MAX_SAFE_INTEGER + 1 },
      { ...valid, occurredAt: new Date(2025, 0, 3, 1) },
      { ...valid, toAccountId: bankId },
      { ...valid, fromAccountId: 'not-an-id' },
    ]) {
      await assert.rejects(data.recordTransfer(input));
    }

    database.prepare('UPDATE accounts SET deleted_at = ? WHERE id = ?').run(submittedAt.getTime(), cashId);
    await assert.rejects(data.recordTransfer(valid), /active account/i);
    assert.equal(count(database, 'transfers'), 0);
    assert.equal(notifications, 0);
  } finally {
    database.close();
  }
});

test('accepts the safe maximum only when both resulting balances remain representable', async () => {
  const successful = openMigratedDatabase();
  try {
    const { bankId, cashId } = accountIds(successful);
    setOpeningBalances(successful, MAX_VND_AMOUNT, 0);
    const data = createAccountData(createProxyDatabase(successful), undefined, {
      now: () => submittedAt,
    });
    await data.recordTransfer({
      fromAccountId: bankId,
      toAccountId: cashId,
      amount: MAX_VND_AMOUNT,
      occurredAt,
    });
    const balances = await data.readAccountBalances();
    assert.equal(balances.find((account) => account.accountId === bankId)?.balance, 0);
    assert.equal(balances.find((account) => account.accountId === cashId)?.balance, MAX_VND_AMOUNT);
  } finally {
    successful.close();
  }

  const overflow = openMigratedDatabase();
  try {
    const { bankId, cashId } = accountIds(overflow);
    setOpeningBalances(overflow, 0, MAX_VND_AMOUNT);
    const data = createAccountData(createProxyDatabase(overflow), undefined, {
      now: () => submittedAt,
    });
    await assert.rejects(
      data.recordTransfer({ fromAccountId: bankId, toAccountId: cashId, amount: 1, occurredAt }),
      /safe integer range/i
    );
    assert.equal(count(overflow, 'transfers'), 0);
  } finally {
    overflow.close();
  }

  const underflow = openMigratedDatabase();
  try {
    const { bankId, cashId } = accountIds(underflow);
    databaseExpenseAtSafeMinimum(underflow, bankId);
    const data = createAccountData(createProxyDatabase(underflow), undefined, {
      now: () => submittedAt,
    });
    await assert.rejects(
      data.recordTransfer({ fromAccountId: bankId, toAccountId: cashId, amount: 1, occurredAt }),
      /safe integer range/i
    );
    assert.equal(count(underflow, 'transfers'), 0);
  } finally {
    underflow.close();
  }
});

function databaseExpenseAtSafeMinimum(
  database: ReturnType<typeof openMigratedDatabase>,
  bankId: string
): void {
  database
    .prepare(
      "INSERT INTO transactions (account_id, direction, amount, occurred_at, status) VALUES (?, 'expense', ?, ?, 'complete')"
    )
    .run(bankId, MAX_VND_AMOUNT, occurredAt.getTime());
}

test('rolls back an inserted transfer when the transaction fails before commit', async () => {
  const database = openMigratedDatabase();
  try {
    const { bankId, cashId } = accountIds(database);
    const notifier = createLedgerChangeNotifier();
    let notifications = 0;
    notifier.subscribe(() => {
      notifications += 1;
    });
    const data = createAccountData(
      createProxyDatabase(database, {
        afterQuery(query) {
          if (query.toLowerCase().includes('insert into "transfers"')) {
            throw new Error('forced transfer failure');
          }
        },
      }),
      notifier,
      { now: () => submittedAt }
    );

    await assert.rejects(
      data.recordTransfer({ fromAccountId: bankId, toAccountId: cashId, amount: 1, occurredAt })
    );
    assert.equal(count(database, 'transfers'), 0);
    assert.equal(notifications, 0);
  } finally {
    database.close();
  }
});
