/**
 * Drizzle adapters for Carryover's integer VND values.
 *
 * This module stays on the database side of the boundary. The widget imports
 * only the pure currency module, so its separate runtime never loads Drizzle.
 */
import { customType } from 'drizzle-orm/sqlite-core';

import {
  nonNegativeVndAmountSchema,
  positiveVndAmountSchema,
} from './money-validation';

type VndCustomType = {
  data: number;
  driverData: number;
};

const positiveVndColumn = customType<VndCustomType>({
  dataType: () => 'integer',
  toDriver: (value) => positiveVndAmountSchema.parse(value),
  fromDriver: (value) => positiveVndAmountSchema.parse(value),
});

const nonNegativeVndColumn = customType<VndCustomType>({
  dataType: () => 'integer',
  toDriver: (value) => nonNegativeVndAmountSchema.parse(value),
  fromDriver: (value) => nonNegativeVndAmountSchema.parse(value),
});

export function vndAmount(name?: string) {
  return name === undefined ? positiveVndColumn() : positiveVndColumn(name);
}

export function nonNegativeVndAmount(name?: string) {
  return name === undefined ? nonNegativeVndColumn() : nonNegativeVndColumn(name);
}
