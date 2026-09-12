import { strict as assert } from 'node:assert';

import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';
import { createShareData } from '../src/data/shares';
import { resolveOwnShareAmounts } from '../src/money/own-expense';

function idFor(database: ReturnType<typeof openMigratedDatabase>, query: string): string {
  const row = database.prepare(query).get() as { id: string } | undefined;
  if (row === undefined) throw new Error(`Missing id for ${query}`);
  return row.id;
}

test('share reads hide soft-deleted rows and preserve the own participant', async () => {
  const database = openMigratedDatabase();
  try {
    const transactionId = '33333333-3333-4333-8333-333333333333';
    const contactId = '44444444-4444-4444-8444-444444444444';
    const bankId = idFor(database, "SELECT id FROM accounts WHERE name = 'Bank'");
    const categoryId = idFor(
      database,
      "SELECT id FROM categories WHERE name = 'Groceries' AND deleted_at IS NULL"
    );
    database
      .prepare('INSERT INTO contacts (id, name) VALUES (?, ?)')
      .run(contactId, 'Alex');
    database
      .prepare(
        `INSERT INTO transactions
          (id, account_id, direction, amount, category_id, occurred_at, status)
         VALUES (?, ?, 'expense', 100000, ?, ?, 'complete')`
      )
      .run(transactionId, bankId, categoryId, new Date(2026, 8, 10).getTime());
    database
      .prepare(
        'INSERT INTO splits (id, transaction_id, contact_id, share_amount) VALUES (?, ?, ?, ?)'
      )
      .run('55555555-5555-4555-8555-555555555551', transactionId, null, 40_000);
    database
      .prepare(
        'INSERT INTO splits (id, transaction_id, contact_id, share_amount) VALUES (?, ?, ?, ?)'
      )
      .run('55555555-5555-4555-8555-555555555552', transactionId, contactId, 60_000);

    const data = createShareData(createProxyDatabase(database));
    const initialRows = await data.readShares();
    assert.equal(initialRows.length, 2);
    assert.equal(initialRows[0]?.transactionId, transactionId);
    assert.equal(initialRows[0]?.contactId, null);
    assert.equal(initialRows[0]?.shareAmount, 40_000);
    assert.equal(initialRows[1]?.transactionId, transactionId);
    assert.equal(initialRows[1]?.contactId, contactId);
    assert.equal(initialRows[1]?.shareAmount, 60_000);

    database
      .prepare("UPDATE splits SET deleted_at = 1735689600000 WHERE contact_id = ?")
      .run(contactId);
    const activeRows = await data.readShares();
    assert.equal(activeRows.length, 1);
    assert.equal(activeRows[0]?.transactionId, transactionId);
    assert.equal(activeRows[0]?.contactId, null);
    assert.equal(activeRows[0]?.shareAmount, 40_000);

    database
      .prepare('UPDATE transactions SET deleted_at = 1735689600000 WHERE id = ?')
      .run(transactionId);
    const rowsAfterTransactionDeletion = await data.readShares();
    assert.equal(rowsAfterTransactionDeletion.length, 0);
    assert.equal(resolveOwnShareAmounts([], rowsAfterTransactionDeletion).size, 0);

    const auditRows = await data.readShares({ includeDeleted: true });
    assert.equal(auditRows.length, 2);
    assert.equal(auditRows[0]?.transactionId, transactionId);
    assert.equal(auditRows[1]?.transactionId, transactionId);
  } finally {
    database.close();
  }
});
