import { strict as assert } from 'node:assert';

import { MAX_VND_AMOUNT } from '../src/money/currency';
import { createAccountData } from '../src/data/accounts';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

type IdRow = { id: unknown };
type AccountRow = { opening_balance: unknown };
type TransferRow = {
  from_account_id: unknown;
  to_account_id: unknown;
  amount: unknown;
};
type ReportRow = { spending: unknown; income: unknown };

const occurredAt = new Date(1735689600000);

function accountId(database: ReturnType<typeof openMigratedDatabase>, name: string): string {
  const row = database
    .prepare('SELECT id FROM accounts WHERE name = ? AND deleted_at IS NULL')
    .get(name) as IdRow | undefined;
  if (!row || typeof row.id !== 'string') {
    throw new Error(`Missing active account ${name}`);
  }
  return row.id;
}

function reportTotals(database: ReturnType<typeof openMigratedDatabase>): ReportRow {
  return database
    .prepare(
      "SELECT COALESCE(SUM(CASE WHEN direction = 'expense' THEN amount ELSE 0 END), 0) AS spending, COALESCE(SUM(CASE WHEN direction = 'income' THEN amount ELSE 0 END), 0) AS income FROM transactions WHERE deleted_at IS NULL"
    )
    .get() as ReportRow;
}

test('opening balance edits validate before writing and persist integer VND', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const data = createAccountData(createProxyDatabase(database));

    await data.updateOpeningBalance({ accountId: bankId, openingBalance: 1_250_000 });
    const updated = database
      .prepare('SELECT opening_balance FROM accounts WHERE id = ?')
      .get(bankId) as AccountRow;
    assert.equal(updated.opening_balance, 1_250_000);
    assert.equal(typeof updated.opening_balance, 'number');

    await assert.rejects(
      data.updateOpeningBalance({ accountId: bankId, openingBalance: 12.5 }),
      /integer|VND|number/i
    );
    const unchanged = database
      .prepare('SELECT opening_balance FROM accounts WHERE id = ?')
      .get(bankId) as AccountRow;
    assert.equal(unchanged.opening_balance, 1_250_000);
  } finally {
    database.close();
  }
});

test('transfers derive both account balances without changing spending or income', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const cashId = accountId(database, 'Cash');
    const data = createAccountData(createProxyDatabase(database));

    await data.updateOpeningBalance({ accountId: bankId, openingBalance: 1_000_000 });
    await data.updateOpeningBalance({ accountId: cashId, openingBalance: 250_000 });
    database
      .prepare(
        "INSERT INTO transactions (account_id, direction, amount, occurred_at, status) VALUES (?, 'expense', 100000, ?, 'complete'), (?, 'income', 50000, ?, 'complete')"
      )
      .run(bankId, occurredAt.getTime(), bankId, occurredAt.getTime());

    const beforeRows = await data.readAccountBalances();
    const beforeBank = beforeRows.find((account) => account.accountId === bankId);
    const beforeCash = beforeRows.find((account) => account.accountId === cashId);
    if (!beforeBank || !beforeCash) {
      throw new Error('Expected seeded accounts');
    }
    const beforeReports = reportTotals(database);
    const beforeTransactionCount = database
      .prepare('SELECT COUNT(*) AS count FROM transactions')
      .get() as { count: unknown };

    await data.recordTransfer({
      fromAccountId: bankId,
      toAccountId: cashId,
      amount: 200_000,
      occurredAt,
    });

    const afterRows = await data.readAccountBalances();
    const afterBank = afterRows.find((account) => account.accountId === bankId);
    const afterCash = afterRows.find((account) => account.accountId === cashId);
    if (!afterBank || !afterCash) {
      throw new Error('Expected transferred accounts');
    }
    assert.equal(beforeBank.balance, 950_000);
    assert.equal(beforeCash.balance, 250_000);
    assert.equal(afterBank.balance, 750_000);
    assert.equal(afterCash.balance, 450_000);
    assert.equal(beforeBank.balance + beforeCash.balance, afterBank.balance + afterCash.balance);

    const transfer = database
      .prepare('SELECT from_account_id, to_account_id, amount FROM transfers')
      .get() as TransferRow;
    assert.equal(transfer.from_account_id, bankId);
    assert.equal(transfer.to_account_id, cashId);
    assert.equal(transfer.amount, 200_000);

    const afterReports = reportTotals(database);
    assert.equal(afterReports.spending, beforeReports.spending);
    assert.equal(afterReports.income, beforeReports.income);
    const afterTransactionCount = database
      .prepare('SELECT COUNT(*) AS count FROM transactions')
      .get() as { count: unknown };
    assert.equal(afterTransactionCount.count, beforeTransactionCount.count);
  } finally {
    database.close();
  }
});

test('an expense paid by a contact does not change your account balance', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const data = createAccountData(createProxyDatabase(database));
    await data.updateOpeningBalance({ accountId: bankId, openingBalance: 1_000_000 });
    const contact = database
      .prepare("INSERT INTO contacts (name) VALUES ('Lan') RETURNING id")
      .get() as IdRow;
    if (typeof contact.id !== 'string') {
      throw new Error('Expected contact id');
    }

    database
      .prepare(
        "INSERT INTO transactions (account_id, direction, amount, payer_contact_id, occurred_at, status) VALUES (?, 'expense', 200000, ?, ?, 'complete')"
      )
      .run(bankId, contact.id, occurredAt.getTime());

    const balances = await data.readAccountBalances();
    const bank = balances.find((account) => account.accountId === bankId);
    assert.equal(bank?.balance, 1_000_000);
  } finally {
    database.close();
  }
});

test('invalid or inactive transfer accounts do not write a transfer', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const cashId = accountId(database, 'Cash');
    const data = createAccountData(createProxyDatabase(database));
    const before = database.prepare('SELECT COUNT(*) AS count FROM transfers').get() as {
      count: unknown;
    };

    await assert.rejects(
      data.recordTransfer({
        fromAccountId: bankId,
        toAccountId: bankId,
        amount: 1,
        occurredAt,
      })
    );
    await assert.rejects(
      data.recordTransfer({
        fromAccountId: bankId,
        toAccountId: '33333333-3333-4333-8333-333333333333',
        amount: 1,
        occurredAt,
      }),
      /not found/i
    );
    database
      .prepare('UPDATE accounts SET deleted_at = ? WHERE name = \'Cash\'')
      .run(occurredAt.getTime());
    await assert.rejects(
      data.recordTransfer({
        fromAccountId: bankId,
        toAccountId: cashId,
        amount: 1,
        occurredAt,
      }),
      /not found/i
    );

    const after = database.prepare('SELECT COUNT(*) AS count FROM transfers').get() as {
      count: unknown;
    };
    assert.equal(after.count, before.count);
  } finally {
    database.close();
  }
});

test('deleting an account preserves its transfer effects on active balances', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const cashId = accountId(database, 'Cash');
    const data = createAccountData(createProxyDatabase(database));

    await data.updateOpeningBalance({ accountId: bankId, openingBalance: 1_000_000 });
    await data.recordTransfer({
      fromAccountId: bankId,
      toAccountId: cashId,
      amount: 200_000,
      occurredAt,
    });
    database
      .prepare('UPDATE accounts SET deleted_at = ? WHERE id = ?')
      .run(occurredAt.getTime(), cashId);

    const balances = await data.readAccountBalances();
    assert.equal(balances.length, 1);
    assert.equal(balances[0]?.accountId, bankId);
    assert.equal(balances[0]?.balance, 800_000);
  } finally {
    database.close();
  }
});

test('account balance reads have no stored running-total column', () => {
  const database = openMigratedDatabase();
  try {
    const columns = database.prepare('PRAGMA table_info(accounts)').all() as Array<{
      name: unknown;
    }>;
    assert.equal(columns.some((column) => column.name === 'balance'), false);
  } finally {
    database.close();
  }
});

test('active account choices remain readable after an adjustment', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const data = createAccountData(createProxyDatabase(database));
    database
      .prepare(
        "INSERT INTO transactions (account_id, direction, adjustment_effect, amount, occurred_at, status) VALUES (?, 'adjustment', 'increase', 50000, ?, 'complete')"
      )
      .run(bankId, occurredAt.getTime());

    assert.equal((await data.readAccountBalances())[0]?.balance, 50_000);
    const choices = await data.listActiveAccounts();
    assert.equal(
      choices.map((account) => account.name).sort().join(','),
      'Bank,Cash'
    );
  } finally {
    database.close();
  }
});

test('reconcile writes one positive adjustment atomically and preserves report totals', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const changes: string[] = [];
    const data = createAccountData(
      createProxyDatabase(database, {
        afterQuery(query, _params, _method) {
          if (query.toLowerCase().includes('insert into') && query.toLowerCase().includes('transactions')) {
            changes.push(query);
          }
        },
      })
    );
    await data.updateOpeningBalance({ accountId: bankId, openingBalance: 1_000_000 });
    const beforeReports = reportTotals(database);
    const result = await data.reconcileAccount({
      accountId: bankId,
      statedBalance: 1_250_000,
      occurredAt,
    });

    assert.equal(result.status, 'adjusted');
    if (result.status !== 'adjusted') {
      throw new Error('Expected an adjustment');
    }
    assert.equal(result.adjustmentAmount, 250_000);
    assert.equal(result.adjustmentEffect, 'increase');
    assert.equal(changes.length, 1);
    const row = database
      .prepare(
        "SELECT amount, adjustment_effect, direction, status FROM transactions WHERE id = ?"
      )
      .get(result.adjustmentId) as {
      amount: unknown;
      adjustment_effect: unknown;
      direction: unknown;
      status: unknown;
    };
    assert.equal(row.amount, 250_000);
    assert.equal(row.adjustment_effect, 'increase');
    assert.equal(row.direction, 'adjustment');
    assert.equal(row.status, 'complete');
    assert.equal((await data.readAccountBalances())[0]?.balance, 1_250_000);
    assert.deepEqual(reportTotals(database), beforeReports);
  } finally {
    database.close();
  }
});

test('reconcile uses the same balance semantics for contacts, drafts, transfers, and deleted rows', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const cashId = accountId(database, 'Cash');
    const data = createAccountData(createProxyDatabase(database));
    await data.updateOpeningBalance({ accountId: bankId, openingBalance: 1_000_000 });
    const contact = database
      .prepare("INSERT INTO contacts (name) VALUES ('Lan') RETURNING id")
      .get() as IdRow;
    if (typeof contact.id !== 'string') {
      throw new Error('Expected contact id');
    }
    database
      .prepare(
        "INSERT INTO transactions (account_id, direction, amount, payer_contact_id, occurred_at, status) VALUES (?, 'expense', 100000, ?, ?, 'complete')"
      )
      .run(bankId, contact.id, occurredAt.getTime());
    database
      .prepare(
        "INSERT INTO transactions (account_id, direction, amount, occurred_at, status) VALUES (?, 'expense', NULL, ?, 'draft')"
      )
      .run(bankId, occurredAt.getTime());
    database
      .prepare(
        "INSERT INTO transactions (account_id, direction, amount, occurred_at, status, deleted_at) VALUES (?, 'income', 400000, ?, 'complete', ?)"
      )
      .run(bankId, occurredAt.getTime(), occurredAt.getTime());
    database
      .prepare(
        'INSERT INTO transfers (from_account_id, to_account_id, amount, occurred_at) VALUES (?, ?, 200000, ?)'
      )
      .run(bankId, cashId, occurredAt.getTime());

    const result = await data.reconcileAccount({
      accountId: bankId,
      statedBalance: 700_000,
      occurredAt,
    });
    assert.equal(result.status, 'adjusted');
    if (result.status !== 'adjusted') {
      throw new Error('Expected an adjustment');
    }
    assert.equal(result.adjustmentAmount, 100_000);
    assert.equal(result.adjustmentEffect, 'decrease');
  } finally {
    database.close();
  }
});

test('reconciling downward stores a decrease, while a no-op stays unchanged and silent', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const events: string[] = [];
    const data = createAccountData(
      createProxyDatabase(database),
      {
        notify(change) {
          events.push(`${change.table}:${change.mutation}`);
        },
        subscribe() {
          return () => undefined;
        },
      }
    );
    await data.updateOpeningBalance({ accountId: bankId, openingBalance: 1_000_000 });
    const result = await data.reconcileAccount({
      accountId: bankId,
      statedBalance: 750_000,
      occurredAt,
    });
    assert.equal(result.status, 'adjusted');
    if (result.status !== 'adjusted') {
      throw new Error('Expected an adjustment');
    }
    assert.equal(result.adjustmentAmount, 250_000);
    assert.equal(result.adjustmentEffect, 'decrease');

    const beforeNoOp = database
      .prepare('SELECT COUNT(*) AS count FROM transactions')
      .get() as { count: number };
    const noOp = await data.reconcileAccount({
      accountId: bankId,
      statedBalance: 750_000,
      occurredAt,
    });
    const afterNoOp = database
      .prepare('SELECT COUNT(*) AS count FROM transactions')
      .get() as { count: number };
    assert.deepEqual(noOp, { status: 'unchanged', accountId: bankId, balance: 750_000 });
    assert.equal(afterNoOp.count, beforeNoOp.count);
    assert.deepEqual(events, [
      'accounts:edited',
      'transactions:created',
    ]);
  } finally {
    database.close();
  }
});

test('reconcile rejects inactive or unsafe accounts without writing', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const data = createAccountData(createProxyDatabase(database));
    const before = database
      .prepare('SELECT COUNT(*) AS count FROM transactions')
      .get() as { count: number };

    await assert.rejects(
      data.reconcileAccount({
        accountId: '33333333-3333-4333-8333-333333333333',
        statedBalance: 1,
        occurredAt,
      }),
      /not found/i
    );
    database
      .prepare('UPDATE accounts SET deleted_at = ? WHERE id = ?')
      .run(occurredAt.getTime(), bankId);
    await assert.rejects(
      data.reconcileAccount({ accountId: bankId, statedBalance: 1, occurredAt }),
      /not found/i
    );
    assert.equal(
      (database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count,
      before.count
    );
  } finally {
    database.close();
  }
});

test('reconcile rejects a delta outside the safe VND range without writing', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const data = createAccountData(createProxyDatabase(database));
    database
      .prepare('UPDATE accounts SET opening_balance = 0 WHERE id = ?')
      .run(bankId);
    database
      .prepare(
        "INSERT INTO transactions (account_id, direction, amount, occurred_at, status) VALUES (?, 'expense', ?, ?, 'complete')"
      )
      .run(bankId, MAX_VND_AMOUNT, occurredAt.getTime());
    const before = database
      .prepare('SELECT COUNT(*) AS count FROM transactions')
      .get() as { count: number };

    await assert.rejects(
      data.reconcileAccount({
        accountId: bankId,
        statedBalance: MAX_VND_AMOUNT,
        occurredAt,
      }),
      /safe VND|range|delta/i
    );
    assert.equal(
      (database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count,
      before.count
    );
  } finally {
    database.close();
  }
});

test('reconcile rejects an unsafe balance aggregate before adding it', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const data = createAccountData(createProxyDatabase(database));
    database
      .prepare(
        "INSERT INTO transactions (account_id, direction, amount, occurred_at, status) VALUES (?, 'income', ?, ?, 'complete'), (?, 'income', ?, ?, 'complete')"
      )
      .run(
        bankId,
        MAX_VND_AMOUNT,
        occurredAt.getTime(),
        bankId,
        MAX_VND_AMOUNT,
        occurredAt.getTime()
      );

    await assert.rejects(
      data.reconcileAccount({
        accountId: bankId,
        statedBalance: 0,
        occurredAt,
      }),
      /safe VND range/
    );
    assert.equal(
      (database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as {
        count: number;
      }).count,
      2
    );
  } finally {
    database.close();
  }
});

test('reconcile accepts a safe final balance after an exact subtotal exceeds the safe VND amount', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const data = createAccountData(createProxyDatabase(database));
    await data.updateOpeningBalance({
      accountId: bankId,
      openingBalance: MAX_VND_AMOUNT,
    });
    database
      .prepare(
        "INSERT INTO transactions (account_id, direction, amount, occurred_at, status) VALUES (?, 'expense', ?, ?, 'complete'), (?, 'expense', 1, ?, 'complete')"
      )
      .run(
        bankId,
        MAX_VND_AMOUNT,
        occurredAt.getTime(),
        bankId,
        occurredAt.getTime()
      );

    assert.equal((await data.readAccountBalances())[0]?.balance, -1);
    const result = await data.reconcileAccount({
      accountId: bankId,
      statedBalance: 0,
      occurredAt,
    });

    assert.equal(result.status, 'adjusted');
    if (result.status !== 'adjusted') {
      throw new Error('Expected an adjustment');
    }
    assert.equal(result.adjustmentAmount, 1);
    assert.equal(result.adjustmentEffect, 'increase');
    assert.equal((await data.readAccountBalances())[0]?.balance, 0);
  } finally {
    database.close();
  }
});

test('reconcile reports a concurrent ledger change after an empty atomic insert', async () => {
  const database = openMigratedDatabase();
  try {
    const bankId = accountId(database, 'Bank');
    const events: string[] = [];
    let changed = false;
    const data = createAccountData(
      createProxyDatabase(database, {
        afterQuery(query) {
          if (
            !changed &&
            query.toLowerCase().includes('insert into') &&
            query.toLowerCase().includes('transactions')
          ) {
            changed = true;
            database
              .prepare('UPDATE accounts SET opening_balance = 1 WHERE id = ?')
              .run(bankId);
          }
        },
      }),
      {
        notify(change) {
          events.push(`${change.table}:${change.mutation}`);
        },
        subscribe() {
          return () => undefined;
        },
      }
    );

    await assert.rejects(
      data.reconcileAccount({
        accountId: bankId,
        statedBalance: 0,
        occurredAt,
      }),
      /changed during reconcile/
    );
    assert.equal(
      (database.prepare('SELECT COUNT(*) AS count FROM transactions').get() as {
        count: number;
      }).count,
      0
    );
    assert.deepEqual(events, []);
  } finally {
    database.close();
  }
});
