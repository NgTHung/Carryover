import type { MonthSummary } from './month-summary';

export const FIXTURE_MONTH_SUMMARY: MonthSummary = {
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
};
