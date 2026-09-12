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
import {
  readBudgetInput,
  type BudgetInputWithoutWriteTime,
} from '../budget/snapshot-source';
import { createAccountData } from './accounts';
import { createCategoryData } from './categories';
import { createCommitmentData } from './commitments';
import { ledgerChangeNotifier } from './ledger-change-notifier';
import { createLedgerReads } from './ledger-reads';
import { createMonthConfigData } from './month-config';
import { createMonthSummaryData } from './month-summary';
import { ledgerTables } from './schema';
import { createShareData } from './shares';
import { createTransactionData } from './transactions';
import { createTransactionListData } from './transaction-list';

export const sqlite = openDatabaseSync('carryover.db');
sqlite.execSync('PRAGMA foreign_keys = ON;');
sqlite.execSync('PRAGMA journal_mode = WAL;');

export const ledgerDb = drizzle(sqlite, { schema: ledgerTables });
export const accountData = createAccountData(ledgerDb, ledgerChangeNotifier);
export const categoryData = createCategoryData(ledgerDb, ledgerChangeNotifier);
export const commitmentData = createCommitmentData(ledgerDb, ledgerChangeNotifier);
export const monthConfigData = createMonthConfigData(ledgerDb, ledgerChangeNotifier);
export const shareData = createShareData(ledgerDb);
export const monthSummaryData = createMonthSummaryData(ledgerDb);
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

export async function readCommittedBudgetInput(
  now: Date
): Promise<BudgetInputWithoutWriteTime> {
  let input: BudgetInputWithoutWriteTime | undefined;

  await sqlite.withExclusiveTransactionAsync(async (transaction) => {
    const transactionDb = drizzle(transaction, { schema: ledgerTables });
    input = await readBudgetInput(
      {
        accounts: createAccountData(transactionDb, ledgerChangeNotifier),
        commitments: createCommitmentData(transactionDb, ledgerChangeNotifier),
        monthConfig: createMonthConfigData(transactionDb, ledgerChangeNotifier),
        shares: createShareData(transactionDb),
        transactions: createTransactionData(
          transactionDb,
          createCategoryData(transactionDb, ledgerChangeNotifier),
          ledgerChangeNotifier
        ),
      },
      now
    );
  });

  if (input === undefined) {
    throw new Error('Budget input transaction completed without a result');
  }
  return input;
}

export async function readCommittedMonthSummary(period: unknown) {
  let summary: Awaited<ReturnType<typeof monthSummaryData.readMonthSummary>>;

  await sqlite.withExclusiveTransactionAsync(async (transaction) => {
    const transactionDb = drizzle(transaction, { schema: ledgerTables });
    summary = await createMonthSummaryData(transactionDb).readMonthSummary(period);
  });

  return summary;
}

export { ledgerChangeNotifier };
export { migrations as ledgerMigrations };
