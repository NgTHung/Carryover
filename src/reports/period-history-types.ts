/**
 * Public shapes for the day-level period report.
 *
 * Keeping the result types separate lets the arithmetic module stay small and
 * gives UI consumers a stable, data-only contract to render.
 */
import type { DateOnly } from '../data/date-only';
import type { MonthSummaryInput } from './month-summary';

export type SpendStep = 0 | 1 | 2 | 3 | 4;

export type HistoryTransaction = {
  id: string;
  direction: 'expense' | 'income';
  status: 'draft' | 'complete';
  amount: number | null;
  label: string;
};

export type PeriodHistoryDay = {
  date: DateOnly;
  day: number;
  phase: 'elapsed' | 'today' | 'future';
  spend: number;
  income: number;
  spendStep: SpendStep;
  unknownDrafts: number;
  transactions: readonly HistoryTransaction[];
};

export type PeriodHistoryPoint = {
  day: number;
  amount: number;
};

export type PeriodHistoryGap = {
  relation: 'above' | 'below' | 'equal';
  amount: number;
  day: number;
};

export type PeriodHistoryReference =
  | {
      status: 'none';
    }
  | {
      status: 'available';
      label: string;
      sampleCount: number;
      points: readonly PeriodHistoryPoint[];
    };

export type PeriodHistory = {
  perDay: number | null;
  cutoffDay: number;
  actualPoints: readonly PeriodHistoryPoint[];
  reference: PeriodHistoryReference;
  gap: PeriodHistoryGap | null;
  days: readonly PeriodHistoryDay[];
};

export type PeriodHistoryInput = {
  current: MonthSummaryInput;
  today: DateOnly;
  references: readonly MonthSummaryInput[];
};
