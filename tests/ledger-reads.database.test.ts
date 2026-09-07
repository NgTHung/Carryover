import { strict as assert } from 'node:assert';

import { createLedgerReads } from '../src/data/ledger-reads';
import { createProxyDatabase, openMigratedDatabase } from './support/sqlite-proxy';

test('public ledger reads hide deleted rows unless explicitly included', async () => {
  const database = openMigratedDatabase();
  try {
    database
      .prepare("INSERT INTO accounts (name, kind, opening_balance) VALUES ('Visible', 'bank', 1000), ('Hidden', 'cash', 500)")
      .run();
    const hidden = database
      .prepare("SELECT id FROM accounts WHERE name = 'Hidden'")
      .get() as { id: string };
    database
      .prepare('UPDATE accounts SET deleted_at = 1735689600000 WHERE id = ?')
      .run(hidden.id);

    const reads = createLedgerReads(createProxyDatabase(database));
    const activeRows = await reads.accounts().all();
    assert.equal(activeRows.length, 1);
    assert.equal(String(activeRows[0]?.name), 'Visible');

    const allRows = await reads.accounts({ includeDeleted: true }).all();
    assert.equal(allRows.length, 2);
    const allNames = allRows.map((row) => String(row.name));
    assert.ok(allNames.includes('Hidden'));
    assert.ok(allNames.includes('Visible'));
  } finally {
    database.close();
  }
});

test('public ledger reads return one mapped row or undefined through get', async () => {
  const database = openMigratedDatabase();
  try {
    database.prepare("INSERT INTO contacts (name) VALUES ('Lan')").run();

    const reads = createLedgerReads(createProxyDatabase(database));
    const contact = await reads.contacts().get();
    assert.equal(contact?.name, 'Lan');
    assert.ok(contact?.createdAt instanceof Date);

    database.prepare('UPDATE contacts SET deleted_at = 1735689600000').run();
    assert.equal(await reads.contacts().get(), undefined);
  } finally {
    database.close();
  }
});
