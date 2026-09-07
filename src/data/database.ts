/**
 * The app's single SQLite connection and migration bundle.
 *
 * Foreign-key enforcement is connection-local in SQLite, so it is enabled
 * before any feature opens a transaction. The migration hook in App.tsx keeps
 * the existing screen behind a clear loading or error state until the schema
 * is ready.
 */
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import migrations from '../../drizzle/migrations';
import { createAccountData } from './accounts';
import { createCategoryData } from './categories';
import { createLedgerReads } from './ledger-reads';
import { ledgerTables } from './schema';
import { createTransactionData } from './transactions';

export const sqlite = openDatabaseSync('carryover.db');
sqlite.execSync('PRAGMA foreign_keys = ON;');
sqlite.execSync('PRAGMA journal_mode = WAL;');

export const ledgerDb = drizzle(sqlite, { schema: ledgerTables });
export const accountData = createAccountData(ledgerDb);
export const categoryData = createCategoryData(ledgerDb);
export const ledgerReads = createLedgerReads(ledgerDb);
export const transactionData = createTransactionData(ledgerDb, categoryData);
export { migrations as ledgerMigrations };
