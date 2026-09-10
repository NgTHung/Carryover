import { strict as assert } from 'node:assert';

import { createAccountData } from '../src/data/accounts';
import { createCategoryData } from '../src/data/categories';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';
import {
  createTransactionListData,
  type TransactionListFilters,
} from '../src/data/transaction-list';
import { createTransactionData } from '../src/data/transactions';

const bankIdQuery = "SELECT id FROM accounts WHERE name = 'Bank'";
const cashIdQuery = "SELECT id FROM accounts WHERE name = 'Cash'";

function idFor(database: ReturnType<typeof openMigratedDatabase>, query: string): string {
  const row = database.prepare(query).get() as { id: string } | undefined;
  if (row === undefined) throw new Error(`Missing id for ${query}`);
  return row.id;
}

function filters(overrides: Partial<TransactionListFilters> = {}): TransactionListFilters {
  return {
    period: '2026-01',
    categoryId: null,
    accountId: null,
    quality: null,
    ...overrides,
  };
}

test('transaction list applies combined filters, preserves history, and shows transfers', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const notifier = createLedgerChangeNotifier();
    const categoryData = createCategoryData(proxy, notifier);
    const accountData = createAccountData(proxy, notifier);
    const transactionData = createTransactionData(proxy, categoryData, notifier);
    const listData = createTransactionListData(proxy, notifier);
    const bankId = idFor(database, bankIdQuery);
    const cashId = idFor(database, cashIdQuery);
    const groceriesId = idFor(
      database,
      "SELECT id FROM categories WHERE name = 'Groceries' AND deleted_at IS NULL"
    );
    const occurredAt = new Date(2026, 0, 12, 10);
    const matching = await transactionData.createTransaction({
      accountId: bankId,
      direction: 'expense',
      status: 'complete',
      amount: 125_000,
      categoryId: groceriesId,
      quality: 'need',
      occurredAt,
    });
    const otherQuality = await transactionData.createTransaction({
      accountId: bankId,
      direction: 'expense',
      status: 'complete',
      amount: 130_000,
      categoryId: groceriesId,
      quality: 'want',
      occurredAt,
    });
    await transactionData.createTransaction({
      accountId: cashId,
      direction: 'expense',
      status: 'complete',
      amount: 140_000,
      categoryId: groceriesId,
      quality: 'need',
      occurredAt,
    });
    const unknown = await transactionData.createTransaction({
      accountId: bankId,
      direction: 'expense',
      status: 'draft',
      amount: ' ',
      occurredAt,
    });
    const directionalTransfer = await transactionData.createTransaction({
      accountId: bankId,
      direction: 'transfer',
      status: 'complete',
      amount: 150_000,
      occurredAt,
    });
    await accountData.recordTransfer({
      fromAccountId: bankId,
      toAccountId: cashId,
      amount: 175_000,
      occurredAt,
    });
    const reconciliation = await accountData.reconcileAccount({
      accountId: bankId,
      statedBalance: 50_000,
      occurredAt,
    });
    assert.equal(reconciliation.status, 'adjusted');
    if (reconciliation.status !== 'adjusted') {
      throw new Error('Expected an adjustment');
    }

    database
      .prepare('UPDATE categories SET deleted_at = ? WHERE id = ?')
      .run(occurredAt.getTime(), groceriesId);

    const matchingRows = await listData.readTransactionList(
      filters({ categoryId: groceriesId, accountId: bankId, quality: 'need' })
    );
    assert.equal(matchingRows.length, 1);
    assert.equal(matchingRows[0]?.kind, 'transaction');
    if (matchingRows[0]?.kind === 'transaction') {
      assert.equal(matchingRows[0].transaction.id, matching.id);
      assert.equal(matchingRows[0].category?.name, 'Groceries');
      assert.equal(matchingRows[0].category?.group.name, 'Food');
      assert.equal(matchingRows[0].account.name, 'Bank');
    }

    const allRows = await listData.readTransactionList(filters());
    const rowIds = allRows.map((row) =>
      row.kind === 'transfer' && row.source === 'transfers'
        ? row.transfer.id
        : row.transaction.id
    );
    assert.ok(rowIds.includes(unknown.id));
    assert.ok(rowIds.includes(directionalTransfer.id));
    assert.ok(rowIds.includes(reconciliation.adjustmentId));
    assert.equal(allRows.filter((row) => row.kind === 'transfer').length, 2);
    const adjustmentRow = allRows.find(
      (row) =>
        row.kind === 'transaction' &&
        row.transaction.id === reconciliation.adjustmentId
    );
    assert.equal(adjustmentRow?.kind, 'transaction');
    if (adjustmentRow?.kind === 'transaction') {
      assert.equal(adjustmentRow.account.id, bankId);
      assert.equal(adjustmentRow.transaction.adjustmentEffect, 'increase');
    }
    const unratedRows = await listData.readTransactionList(
      filters({ quality: 'unrated' })
    );
    assert.equal(unratedRows.some((row) => row.kind === 'transfer'), false);
    assert.equal(
      unratedRows.some(
        (row) =>
          row.kind === 'transaction' &&
          row.transaction.direction === 'adjustment'
      ),
      false
    );
    const unknownRow = allRows.find(
      (row) => row.kind === 'transaction' && row.transaction.id === unknown.id
    );
    assert.equal(unknownRow?.kind, 'transaction');
    if (unknownRow?.kind === 'transaction') assert.equal(unknownRow.transaction.amount, null);
    assert.ok(rowIds.indexOf(otherQuality.id) > -1);
    const repeatedRows = await listData.readTransactionList(filters());
    assert.deepEqual(
      rowIds,
      repeatedRows.map((row) =>
        row.kind === 'transfer' && row.source === 'transfers'
          ? row.transfer.id
          : row.transaction.id
      )
    );
  } finally {
    database.close();
  }
});

test('transaction notifier runs after successful commits only', async () => {
  const database = openMigratedDatabase();
  try {
    const proxy = createProxyDatabase(database);
    const notifier = createLedgerChangeNotifier();
    const events: string[] = [];
    notifier.subscribe((change) => events.push(`${change.table}:${change.mutation}`));
    const categoryData = createCategoryData(proxy, notifier);
    const transactionData = createTransactionData(proxy, categoryData, notifier);
    const bankId = idFor(database, bankIdQuery);
    const occurredAt = new Date(2026, 0, 12, 10);

    const created = await transactionData.createTransaction({
      accountId: bankId,
      direction: 'expense',
      status: 'draft',
      occurredAt,
    });
    assert.equal(events.at(-1), 'transactions:created');
    await transactionData.editTransaction({
      transactionId: created.id,
      changes: { note: 'edited' },
    });
    assert.equal(events.at(-1), 'transactions:edited');
    await transactionData.completeDraft({
      transactionId: created.id,
      amount: 20_000,
      categoryId: idFor(
        database,
        "SELECT id FROM categories WHERE name = 'Groceries' AND deleted_at IS NULL"
      ),
    });
    assert.equal(events.at(-1), 'transactions:completed');
    const beforeFailure = events.length;
    await assert.rejects(
      transactionData.createTransaction({
        accountId: bankId,
        direction: 'expense',
        status: 'complete',
        amount: 0,
        occurredAt,
      })
    );
    assert.equal(events.length, beforeFailure);
    await transactionData.softDeleteTransaction(created.id);
    assert.equal(events.at(-1), 'transactions:deleted');
  } finally {
    database.close();
  }
});
