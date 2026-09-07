import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { drizzle as drizzleProxy } from 'drizzle-orm/sqlite-proxy';
import type { RemoteCallback } from 'drizzle-orm/sqlite-proxy';

import { ledgerTables } from '../../src/data/schema';

export function openMigratedDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(
    readFileSync(resolve(process.cwd(), 'drizzle/0000_initial-ledger.sql'), 'utf8')
  );
  database.exec(
    readFileSync(resolve(process.cwd(), 'drizzle/0001_safe-amount-bounds.sql'), 'utf8')
  );
  return database;
}

export function createProxyDatabase(database: DatabaseSync) {
  const callback: RemoteCallback = async (query, params, method) => {
    const statement = database.prepare(query);
    if (method === 'run') {
      statement.run(...params);
      return { rows: [] };
    }

    statement.setReturnArrays(true);
    const rows = statement.all(...params).map((row) => Object.values(row));
    return { rows: method === 'get' ? rows[0] : rows };
  };

  return drizzleProxy<typeof ledgerTables>(callback, { schema: ledgerTables });
}
