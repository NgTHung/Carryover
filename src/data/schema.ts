/**
 * The SQLite ledger schema shared by the app and migration generator.
 *
 * Foreign keys describe ownership, while soft deletes keep historical rows
 * available for backup and audit. Money columns use the shared VND custom type
 * so ORM writes reject fractional values before SQLite sees them.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

import { CURRENCY_EXPONENT, MAX_VND_AMOUNT } from '../money/currency';
import { nonNegativeVndAmount, vndAmount } from './amount-columns';

const UUID_DEFAULT = sql`(
  lower(
    hex(randomblob(4)) || '-' ||
    hex(randomblob(2)) || '-4' ||
    substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', (random() & 3) + 1, 1) ||
    substr(hex(randomblob(2)), 2) || '-' ||
    hex(randomblob(6))
  )
)`;

const nowMilliseconds = () =>
  sql`(cast((julianday('now') - 2440587.5) * 86400000 as integer))`;

const maxVndSql = sql.raw(MAX_VND_AMOUNT.toString());

function commonColumns() {
  return {
    id: text('id').primaryKey().notNull().default(UUID_DEFAULT),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(nowMilliseconds()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(nowMilliseconds()),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  };
}

function integerVndCheck(
  tableName: string,
  column: AnySQLiteColumn,
  nullable: boolean
) {
  const value = nullable
    ? sql`${column} IS NULL OR (typeof(${column}) = 'integer' AND ${column} <= ${maxVndSql})`
    : sql`typeof(${column}) = 'integer' AND ${column} <= ${maxVndSql}`;
  return check(
    `${tableName}_${column.name}_integer_vnd_e${CURRENCY_EXPONENT}`,
    value
  );
}

function positiveVndCheck(
  tableName: string,
  column: AnySQLiteColumn,
  nullable: boolean
) {
  const value = nullable
    ? sql`${column} IS NULL OR (typeof(${column}) = 'integer' AND ${column} > 0 AND ${column} <= ${maxVndSql})`
    : sql`typeof(${column}) = 'integer' AND ${column} > 0 AND ${column} <= ${maxVndSql}`;
  return check(`${tableName}_${column.name}_positive_vnd`, value);
}

function nonNegativeVndCheck(tableName: string, column: AnySQLiteColumn) {
  return check(
    `${tableName}_${column.name}_non_negative_vnd`,
    sql`typeof(${column}) = 'integer' AND ${column} >= 0 AND ${column} <= ${maxVndSql}`
  );
}

export const accounts = sqliteTable(
  'accounts',
  {
    ...commonColumns(),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['bank', 'cash'] }).notNull(),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    openingBalance: nonNegativeVndAmount('opening_balance').notNull(),
  },
  (table) => [
    nonNegativeVndCheck('accounts', table.openingBalance),
    check('accounts_kind_value', sql`${table.kind} IN ('bank', 'cash')`),
  ]
);

export const categories = sqliteTable(
  'categories',
  {
    ...commonColumns(),
    parentId: text('parent_id').references(
      (): AnySQLiteColumn => categories.id
    ),
    name: text('name').notNull(),
    sort: integer('sort').notNull().default(0),
    kind: text('kind', { enum: ['spend', 'reserve'] }).notNull(),
    isSuggestion: integer('is_suggestion', { mode: 'boolean' })
      .notNull()
      .default(false),
  },
  (table) => [
    check('categories_sort_integer', sql`typeof(${table.sort}) = 'integer'`),
    check('categories_kind_value', sql`${table.kind} IN ('spend', 'reserve')`),
  ]
);

export const contacts = sqliteTable('contacts', {
  ...commonColumns(),
  name: text('name').notNull(),
  userId: text('user_id'),
});

export const transactions = sqliteTable(
  'transactions',
  {
    ...commonColumns(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    direction: text('direction', {
      enum: ['expense', 'income', 'adjustment', 'transfer'],
    }).notNull(),
    amount: vndAmount('amount'),
    categoryId: text('category_id').references(() => categories.id),
    quality: text('quality', {
      enum: ['need', 'want', 'regret'],
    }),
    payerContactId: text('payer_contact_id').references(() => contacts.id),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    status: text('status', { enum: ['draft', 'complete'] })
      .notNull()
      .default('draft'),
    photoKey: text('photo_key'),
    note: text('note'),
    sourceLabel: text('source_label'),
  },
  (table) => [
    integerVndCheck('transactions', table.amount, true),
    positiveVndCheck('transactions', table.amount, true),
    check(
      'transactions_complete_requires_amount',
      sql`${table.status} <> 'complete' OR ${table.amount} IS NOT NULL`
    ),
    check(
      'transactions_direction_value',
      sql`${table.direction} IN ('expense', 'income', 'adjustment', 'transfer')`
    ),
    check(
      'transactions_quality_value',
      sql`${table.quality} IS NULL OR ${table.quality} IN ('need', 'want', 'regret')`
    ),
    check(
      'transactions_status_value',
      sql`${table.status} IN ('draft', 'complete')`
    ),
  ]
);

export const splits = sqliteTable(
  'splits',
  {
    ...commonColumns(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id),
    contactId: text('contact_id').references(() => contacts.id),
    shareAmount: vndAmount('share_amount').notNull(),
  },
  (table) => [positiveVndCheck('splits', table.shareAmount, false)]
);

export const settlements = sqliteTable(
  'settlements',
  {
    ...commonColumns(),
    contactId: text('contact_id').notNull().references(() => contacts.id),
    amount: vndAmount('amount').notNull(),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    direction: text('direction', {
      enum: ['they_paid_me', 'i_paid_them'],
    }).notNull(),
    note: text('note'),
  },
  (table) => [
    positiveVndCheck('settlements', table.amount, false),
    check(
      'settlements_direction_value',
      sql`${table.direction} IN ('they_paid_me', 'i_paid_them')`
    ),
  ]
);

export const commitments = sqliteTable(
  'commitments',
  {
    ...commonColumns(),
    name: text('name').notNull(),
    amount: vndAmount('amount').notNull(),
    dueDay: integer('due_day').notNull(),
    categoryId: text('category_id').notNull().references(() => categories.id),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [
    positiveVndCheck('commitments', table.amount, false),
    check(
      'commitments_due_day_range',
      sql`typeof(${table.dueDay}) = 'integer' AND ${table.dueDay} BETWEEN 1 AND 31`
    ),
  ]
);

export const monthConfig = sqliteTable(
  'month_config',
  {
    ...commonColumns(),
    period: text('period').notNull().unique(),
    openingBalance: nonNegativeVndAmount('opening_balance').notNull(),
    incomeTotal: nonNegativeVndAmount('income_total').notNull(),
    reservedTotal: nonNegativeVndAmount('reserved_total').notNull(),
    horizonDate: text('horizon_date').notNull(),
  },
  (table) => [
    nonNegativeVndCheck('month_config', table.openingBalance),
    nonNegativeVndCheck('month_config', table.incomeTotal),
    nonNegativeVndCheck('month_config', table.reservedTotal),
  ]
);

export const transfers = sqliteTable(
  'transfers',
  {
    ...commonColumns(),
    fromAccountId: text('from_account_id')
      .notNull()
      .references(() => accounts.id),
    toAccountId: text('to_account_id')
      .notNull()
      .references(() => accounts.id),
    amount: vndAmount('amount').notNull(),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    positiveVndCheck('transfers', table.amount, false),
    check(
      'transfers_accounts_differ',
      sql`${table.fromAccountId} <> ${table.toAccountId}`
    ),
  ]
);

export const ledgerTables = {
  accounts,
  categories,
  contacts,
  transactions,
  splits,
  settlements,
  commitments,
  monthConfig,
  transfers,
} as const;
