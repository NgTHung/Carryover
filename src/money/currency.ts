/**
 * Shared VND rules and display helpers.
 *
 * Carryover stores whole dong, so values crossing a database boundary must be
 * safe integers. The database adapter applies these rules at the driver edge,
 * while SQLite CHECK constraints protect writes that bypass ORM mapping.
 */
export const CURRENCY_EXPONENT = 0;

export const CURRENCY_SCALE = 10 ** CURRENCY_EXPONENT;
export const MAX_VND_AMOUNT = Number.MAX_SAFE_INTEGER;

export function assertVndInteger(value: number, field = 'amount'): number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${field} must be an integer VND amount`);
  }
  if (value % CURRENCY_SCALE !== 0) {
    throw new TypeError(`${field} does not match the VND currency exponent`);
  }
  return value;
}

export function assertPositiveVndAmount(value: number, field = 'amount'): number {
  assertVndInteger(value, field);
  if (value <= 0) {
    throw new RangeError(`${field} must be positive`);
  }
  return value;
}

export function assertNonNegativeVndAmount(value: number, field = 'amount'): number {
  assertVndInteger(value, field);
  if (value < 0) {
    throw new RangeError(`${field} must not be negative`);
  }
  return value;
}

export function formatVnd(amount: number): string {
  const integer = assertVndInteger(amount);
  const sign = integer < 0 ? '-' : '';
  const digits = Math.abs(integer)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}₫${digits}`;
}

/**
 * Short form for small surfaces where the full figure does not fit.
 *
 * BigInt performs the compact-unit division without creating a fractional
 * number that could accidentally be reused as a money value.
 */
export function formatVndCompact(
  amount: number,
  currencyExponent: typeof CURRENCY_EXPONENT = CURRENCY_EXPONENT
): string {
  if (currencyExponent !== CURRENCY_EXPONENT) {
    throw new RangeError('Carryover supports VND only');
  }

  const integer = assertVndInteger(amount);
  const negative = integer < 0;
  const absolute = BigInt(Math.abs(integer));
  const sign = negative ? '-' : '';
  const thousand = 1_000n;
  const million = thousand * thousand;

  if (absolute >= million) {
    const whole = absolute / million;
    const tenth = (absolute % million) / 100_000n;
    return tenth === 0n
      ? `${sign}₫${whole.toString()}tr`
      : `${sign}₫${whole.toString()}.${tenth.toString()}tr`;
  }
  if (absolute >= thousand) {
    return `${sign}₫${((absolute + 500n) / thousand).toString()}k`;
  }
  return `${sign}₫${absolute.toString()}`;
}
