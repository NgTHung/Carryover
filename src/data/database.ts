/**
 * The app's single SQLite connection and migration bundle.
 *
 * Foreign-key enforcement is connection-local in SQLite, so it is enabled
 * before any feature opens a transaction. The native root layout keeps every
 * ledger-backed route behind a clear loading or error state until the schema
 * is ready.
 */
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import migrations from '../../drizzle/migrations';
import { createAccountData } from './accounts';
import { createCategoryData } from './categories';
import { ledgerChangeNotifier } from './ledger-change-notifier';
import { createLedgerReads } from './ledger-reads';
import { createMonthConfigData } from './month-config';
import { ledgerTables } from './schema';
import { createTransactionData } from './transactions';
import { createTransactionListData } from './transaction-list';

export const sqlite = openDatabaseSync('carryover.db');
sqlite.execSync('PRAGMA foreign_keys = ON;');
sqlite.execSync('PRAGMA journal_mode = WAL;');

export const ledgerDb = drizzle(sqlite, { schema: ledgerTables });
export const accountData = createAccountData(ledgerDb, ledgerChangeNotifier);
export const categoryData = createCategoryData(ledgerDb, ledgerChangeNotifier);
export const monthConfigData = createMonthConfigData(ledgerDb, ledgerChangeNotifier);
export const ledgerReads = createLedgerReads(ledgerDb);
export const transactionData = createTransactionData(
  ledgerDb,
  categoryData,
  ledgerChangeNotifier
);
export const transactionListData = createTransactionListData(
  ledgerDb,
  ledgerChangeNotifier
);
export { ledgerChangeNotifier };
export { migrations as ledgerMigrations };
