/**
 * The public read boundary for ledger rows.
 *
 * Soft deletes preserve history for backup and audit work, but normal screens
 * should never need to remember that filtering rule. Each table read applies
 * it here and exposes the exception as an explicit option.
 */
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { activeRowFilter, type SoftDeleteOptions } from './soft-delete';
import {
  accounts,
  categories,
  commitments,
  contacts,
  ledgerTables,
  monthConfig,
  settlements,
  splits,
  transactions,
  transfers,
} from './schema';

type LedgerDatabase<TResultKind extends 'sync' | 'async'> = BaseSQLiteDatabase<
  TResultKind,
  unknown,
  typeof ledgerTables
>;

export function createLedgerReads<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>
) {
  return {
    accounts: (options: SoftDeleteOptions = {}) =>
      db.select().from(accounts).where(activeRowFilter(accounts.deletedAt, options)),
    categories: (options: SoftDeleteOptions = {}) =>
      db
        .select()
        .from(categories)
        .where(activeRowFilter(categories.deletedAt, options)),
    contacts: (options: SoftDeleteOptions = {}) =>
      db.select().from(contacts).where(activeRowFilter(contacts.deletedAt, options)),
    transactions: (options: SoftDeleteOptions = {}) =>
      db
        .select()
        .from(transactions)
        .where(activeRowFilter(transactions.deletedAt, options)),
    splits: (options: SoftDeleteOptions = {}) =>
      db.select().from(splits).where(activeRowFilter(splits.deletedAt, options)),
    settlements: (options: SoftDeleteOptions = {}) =>
      db
        .select()
        .from(settlements)
        .where(activeRowFilter(settlements.deletedAt, options)),
    commitments: (options: SoftDeleteOptions = {}) =>
      db
        .select()
        .from(commitments)
        .where(activeRowFilter(commitments.deletedAt, options)),
    monthConfig: (options: SoftDeleteOptions = {}) =>
      db
        .select()
        .from(monthConfig)
        .where(activeRowFilter(monthConfig.deletedAt, options)),
    transfers: (options: SoftDeleteOptions = {}) =>
      db.select().from(transfers).where(activeRowFilter(transfers.deletedAt, options)),
  };
}
