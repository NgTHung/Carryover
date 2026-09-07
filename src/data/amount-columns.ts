/**
 * Drizzle adapters for Carryover's integer VND values.
 *
 * This module stays on the database side of the boundary. The widget imports
 * only the pure currency module, so its separate runtime never loads Drizzle.
 */
import { customType } from 'drizzle-orm/sqlite-core';

import {
  assertNonNegativeVndAmount,
  assertPositiveVndAmount,
} from '../money/currency';

type VndCustomType = {
  data: number;
  driverData: number;
};

const positiveVndColumn = customType<VndCustomType>({
  dataType: () => 'integer',
  toDriver: (value) => assertPositiveVndAmount(value),
  fromDriver: (value) => assertPositiveVndAmount(value),
});

const nonNegativeVndColumn = customType<VndCustomType>({
  dataType: () => 'integer',
  toDriver: (value) => assertNonNegativeVndAmount(value),
  fromDriver: (value) => assertNonNegativeVndAmount(value),
});

export function vndAmount(name?: string) {
  return name === undefined ? positiveVndColumn() : positiveVndColumn(name);
}

export function nonNegativeVndAmount(name?: string) {
  return name === undefined ? nonNegativeVndColumn() : nonNegativeVndColumn(name);
}
