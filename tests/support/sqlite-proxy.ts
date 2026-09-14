import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { drizzle as drizzleProxy } from 'drizzle-orm/sqlite-proxy';
import type { RemoteCallback } from 'drizzle-orm/sqlite-proxy';

import { ledgerTables } from '../../src/data/schema';

type ProxyQueryHook = (
  query: Parameters<RemoteCallback>[0],
  params: Parameters<RemoteCallback>[1],
  method: Parameters<RemoteCallback>[2]
) => void | Promise<void>;

type ProxyDatabaseOptions = {
  afterQuery?: ProxyQueryHook;
};

export function applyMigrations(database: DatabaseSync): void {
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(
    readFileSync(resolve(process.cwd(), 'drizzle/0000_initial-ledger.sql'), 'utf8')
  );
  database.exec(
    readFileSync(resolve(process.cwd(), 'drizzle/0001_safe-amount-bounds.sql'), 'utf8')
  );
  database.exec(
    readFileSync(resolve(process.cwd(), 'drizzle/0002_seed-accounts.sql'), 'utf8')
  );
  database.exec(
    readFileSync(resolve(process.cwd(), 'drizzle/0003_repair-cash-account.sql'), 'utf8')
  );
  database.exec(
    readFileSync(resolve(process.cwd(), 'drizzle/0004_seed-categories.sql'), 'utf8')
  );
  database.exec(
    readFileSync(resolve(process.cwd(), 'drizzle/0005_adjustment-effect.sql'), 'utf8')
  );
  database.exec(
    readFileSync(resolve(process.cwd(), 'drizzle/0006_icy_ronan.sql'), 'utf8')
  );
}

export function openMigratedDatabase(databasePath = ':memory:'): DatabaseSync {
  const database = new DatabaseSync(databasePath);
  applyMigrations(database);
  return database;
}

export function createProxyDatabase(
  database: DatabaseSync,
  options: ProxyDatabaseOptions = {}
) {
  const callback: RemoteCallback = async (query, params, method) => {
    const statement = database.prepare(query);
    if (method === 'run') {
      statement.run(...params);
      await options.afterQuery?.(query, params, method);
      return { rows: [] };
    }

    statement.setReturnArrays(true);
    const rows = statement.all(...params).map((row) => Object.values(row));
    await options.afterQuery?.(query, params, method);
    return { rows: method === 'get' ? rows[0] : rows };
  };

  return drizzleProxy<typeof ledgerTables>(callback, { schema: ledgerTables });
}
