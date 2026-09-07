/**
 * Shared visibility predicate for tables that retain deleted history.
 *
 * Normal reads should be quiet about deleted rows. Callers doing backup or
 * audit work must opt in explicitly, which makes that exception visible at
 * every call site.
 */
import { isNull, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

export type SoftDeleteOptions = {
  includeDeleted?: boolean;
};

export function activeRowFilter(
  deletedAt: AnySQLiteColumn,
  options: SoftDeleteOptions = {}
): SQL | undefined {
  return options.includeDeleted === true ? undefined : isNull(deletedAt);
}
