import {
  CURRENCY_EXPONENT,
  formatVnd,
  formatVndCompact,
} from '../money/currency';

export {
  CURRENCY_EXPONENT,
  formatVnd,
  formatVndCompact,
} from '../money/currency';

/**
 * The budget snapshot every surface reads.
 *
 * The widget runs in its own JavaScript runtime with no access to the database
 * or app state, so it cannot compute anything. Both the home screen and the
 * widget render this object instead, which is why the two can never disagree.
 *
 * `computeBudget` does not exist yet. Stage 0 proves the pipeline and the
 * widget install; app:BUDGET-001 supplies the real implementation behind this
 * same type.
 */

export type BudgetSnapshot = {
  balanceTotal: number;
  reservedUnpaid: number;
  discretionary: number;

  horizonDate: string;
  daysToHorizon: number;
  perDay: number;
  runwayDays: number;

  spentThisMonth: number;
  regrettedThisMonth: number;
  owedToYou: number;

  unloggedDrafts: number;
  updatedAt: string;
};

/**
 * Stand-in numbers for the stage 0 spike. A widget that renders these proves it
 * installed; a widget that renders anything else proves the app reached it.
 */
export const FIXTURE_SNAPSHOT: BudgetSnapshot = {
  balanceTotal: 4_250_000,
  reservedUnpaid: 3_000_000,
  discretionary: 1_250_000,

  horizonDate: '2026-09-30',
  daysToHorizon: 29,
  perDay: 43_000,
  runwayDays: 21,

  spentThisMonth: 780_000,
  regrettedThisMonth: 145_000,
  owedToYou: 200_000,

  unloggedDrafts: 2,
  updatedAt: new Date(0).toISOString(),
};
