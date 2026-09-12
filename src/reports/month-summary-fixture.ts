import { periodDayDate } from '../data/period';
import type { PeriodHistory, PeriodHistoryDay } from './period-history-types';
import type { MonthSummaryWithHistory } from './month-summary';

const FIXTURE_HISTORY_DAYS: PeriodHistoryDay[] = Array.from(
  { length: 30 },
  (_, index) => ({
    date: periodDayDate('2026-09', index + 1),
    day: index + 1,
    phase: index < 13 ? 'elapsed' : index === 13 ? 'today' : 'future',
    spend: index === 5 ? 400_000 : index === 12 ? 200_000 : 0,
    income: index === 7 ? 2_000_000 : 0,
    spendStep: index === 5 ? 3 : index === 12 ? 2 : 0,
    unknownDrafts: index === 6 ? 1 : 0,
    transactions: [],
  })
);

const FIXTURE_HISTORY: PeriodHistory = {
  perDay: 150_000,
  cutoffDay: 14,
  actualPoints: Array.from({ length: 14 }, (_, index) => ({
    day: index + 1,
    amount: index < 6 ? 0 : index < 13 ? 400_000 : 600_000,
  })),
  reference: {
    status: 'available',
    label: 'usual',
    sampleCount: 3,
    points: Array.from({ length: 30 }, (_, index) => ({
      day: index + 1,
      amount: index < 10 ? 100_000 : 500_000,
    })),
  },
  gap: { relation: 'above', amount: 100_000, day: 14 },
  days: FIXTURE_HISTORY_DAYS,
};

export const FIXTURE_MONTH_SUMMARY: MonthSummaryWithHistory = {
  period: '2026-09',
  monthConfig: {
    period: '2026-09',
    openingBalance: 4_000_000,
    incomeTotal: 2_000_000,
    reservedTotal: 900_000,
    horizonDate: '2026-09-28',
  },
  totalSpent: 4_800_000,
  regrettedTotal: 1_000_000,
  unknownDrafts: 2,
  groups: [
    {
      id: 'food',
      name: 'Food',
      amount: 2_200_000,
      barRemainder: 0,
      leaves: [
        { id: 'groceries', name: 'Groceries', amount: 1_400_000 },
        { id: 'eating-out', name: 'Eating out', amount: 800_000 },
      ],
    },
    {
      id: 'home',
      name: 'Home',
      amount: 1_800_000,
      barRemainder: 400_000,
      leaves: [{ id: 'rent', name: 'Rent', amount: 1_800_000 }],
    },
    {
      id: 'transport',
      name: 'Transport',
      amount: 800_000,
      barRemainder: 1_400_000,
      leaves: [{ id: 'fuel', name: 'Fuel', amount: 800_000 }],
    },
  ],
  quality: [
    { quality: 'need', amount: 2_000_000, showDirectLabel: true },
    { quality: 'want', amount: 1_200_000, showDirectLabel: true },
    { quality: 'regret', amount: 1_000_000, showDirectLabel: true },
    { quality: 'unrated', amount: 600_000, showDirectLabel: false },
  ],
  history: FIXTURE_HISTORY,
};
