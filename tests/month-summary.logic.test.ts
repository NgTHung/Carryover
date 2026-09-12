import { strict as assert } from 'node:assert';

import {
  computeMonthSummary,
  type MonthSummaryInput,
  type MonthSummaryTransaction,
} from '../src/reports/month-summary';

const monthConfig = {
  period: '2026-09' as const,
  openingBalance: 4_000_000,
  incomeTotal: 2_000_000,
  reservedTotal: 900_000,
  horizonDate: '2026-09-28' as const,
};

const food = { id: 'food', name: 'Food' };
const groceries = { id: 'groceries', name: 'Groceries' };
const coffee = { id: 'coffee', name: 'Coffee' };
const bills = { id: 'bills', name: 'Bills' };
const rent = { id: 'rent', name: 'Rent' };

function transaction(
  overrides: Partial<MonthSummaryTransaction> &
    Pick<MonthSummaryTransaction, 'id' | 'direction' | 'status' | 'amount'>
): MonthSummaryTransaction {
  return {
    quality: null,
    occurredOn: '2026-09-15',
    group: food,
    leaf: groceries,
    ...overrides,
  };
}

function input(overrides: Partial<MonthSummaryInput> = {}): MonthSummaryInput {
  return {
    period: '2026-09',
    monthConfig,
    transactions: [],
    shares: [],
    ...overrides,
  };
}

test('aggregates groups, leaves, quality, and known drafts deterministically', () => {
  const summary = computeMonthSummary(input({
    transactions: [
      transaction({ id: 'groceries', direction: 'expense', status: 'complete', amount: 100, quality: 'need' }),
      transaction({ id: 'coffee', direction: 'expense', status: 'complete', amount: 50, quality: 'want', leaf: coffee }),
      transaction({ id: 'rent', direction: 'expense', status: 'complete', amount: 25, quality: 'regret', group: bills, leaf: rent }),
      transaction({ id: 'known-draft', direction: 'expense', status: 'draft', amount: 40, group: null, leaf: null }),
      transaction({ id: 'unknown-draft', direction: 'expense', status: 'draft', amount: null, group: null, leaf: null }),
      transaction({ id: 'income', direction: 'income', status: 'complete', amount: 900, group: null, leaf: null }),
      transaction({ id: 'adjustment', direction: 'adjustment', status: 'complete', amount: 800, group: null, leaf: null }),
      transaction({ id: 'transfer', direction: 'transfer', status: 'complete', amount: 700, group: null, leaf: null }),
    ],
  }));

  assert.equal(summary.totalSpent, 215);
  assert.equal(summary.regrettedTotal, 25);
  assert.equal(summary.unknownDrafts, 1);
  assert.deepEqual(summary.groups, [
    {
      id: 'food',
      name: 'Food',
      amount: 150,
      leaves: [
        { id: 'groceries', name: 'Groceries', amount: 100 },
        { id: 'coffee', name: 'Coffee', amount: 50 },
      ],
    },
    { id: 'uncategorized', name: 'No group yet', amount: 40, leaves: [] },
    {
      id: 'bills',
      name: 'Bills',
      amount: 25,
      leaves: [{ id: 'rent', name: 'Rent', amount: 25 }],
    },
  ]);
  assert.deepEqual(
    summary.quality.map(({ quality, amount }) => ({ quality, amount })),
    [
      { quality: 'need', amount: 100 },
      { quality: 'want', amount: 50 },
      { quality: 'regret', amount: 25 },
      { quality: 'unrated', amount: 40 },
    ]
  );
});

test('counts your split share in every report total', () => {
  const summary = computeMonthSummary(input({
    transactions: [
      transaction({ id: 'split', direction: 'expense', status: 'complete', amount: 1_000, quality: 'regret' }),
    ],
    shares: [
      { transactionId: 'split', contactId: null, shareAmount: 250 },
      { transactionId: 'split', contactId: 'contact', shareAmount: 750 },
    ],
  }));

  assert.equal(summary.totalSpent, 250);
  assert.equal(summary.regrettedTotal, 250);
  assert.equal(summary.groups[0]?.amount, 250);
});

test('marks only quality segments over fifteen percent for direct labels', () => {
  const summary = computeMonthSummary(input({
    transactions: [
      transaction({ id: 'need', direction: 'expense', status: 'complete', amount: 15, quality: 'need' }),
      transaction({ id: 'want', direction: 'expense', status: 'complete', amount: 16, quality: 'want' }),
      transaction({ id: 'regret', direction: 'expense', status: 'complete', amount: 69, quality: 'regret' }),
    ],
  }));

  assert.deepEqual(
    summary.quality.map(({ quality, showDirectLabel }) => ({ quality, showDirectLabel })),
    [
      { quality: 'need', showDirectLabel: false },
      { quality: 'want', showDirectLabel: true },
      { quality: 'regret', showDirectLabel: true },
      { quality: 'unrated', showDirectLabel: false },
    ]
  );
});

test('rejects malformed or misplaced report data', () => {
  assert.throws(
    () => computeMonthSummary(input({
      transactions: [transaction({ id: 'split', direction: 'expense', status: 'complete', amount: 100 })],
      shares: [{ transactionId: 'split', contactId: null, shareAmount: 99 }],
    })),
    /must equal/
  );
  assert.throws(
    () => computeMonthSummary(input({
      transactions: [transaction({ id: 'wrong-month', direction: 'expense', status: 'complete', amount: 100, occurredOn: '2026-08-31' })],
    })),
    /does not belong to period/
  );
  assert.throws(
    () => computeMonthSummary(input({
      transactions: [transaction({ id: 'invalid', direction: 'expense', status: 'complete', amount: 1.5 })],
    })),
    /integer VND/
  );
});

test('does not mutate input and preserves the stored config', () => {
  const original = input({
    transactions: [transaction({ id: 'expense', direction: 'expense', status: 'complete', amount: 101 })],
  });
  const before = JSON.stringify(original);
  const first = computeMonthSummary(original);
  const second = computeMonthSummary(original);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(first.monthConfig, monthConfig);
});
