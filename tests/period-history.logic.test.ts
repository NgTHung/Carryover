import { strict as assert } from 'node:assert';

import type { MonthSummaryInput, MonthSummaryTransaction } from '../src/reports/month-summary';
import { periodEndDate } from '../src/data/period';
import {
  computePeriodHistory,
  type PeriodHistoryInput,
} from '../src/reports/period-history';

const food = { id: 'food', name: 'Food' };
const groceries = { id: 'groceries', name: 'Groceries' };

function config(period: MonthSummaryInput['period'] = '2026-09') {
  return {
    period,
    openingBalance: 1_000,
    incomeTotal: 2_000,
    reservedTotal: 0,
    horizonDate: periodEndDate(period),
  };
}

function transaction(
  overrides: Partial<MonthSummaryTransaction> &
    Pick<MonthSummaryTransaction, 'id' | 'direction' | 'status' | 'amount'>
): MonthSummaryTransaction {
  return {
    quality: null,
    occurredOn: '2026-09-01',
    group: food,
    leaf: groceries,
    ...overrides,
  };
}

function periodInput(
  period: MonthSummaryInput['period'],
  transactions: readonly MonthSummaryTransaction[] = [],
  overrides: Partial<MonthSummaryInput> = {}
): MonthSummaryInput {
  return {
    period,
    monthConfig: config(period),
    transactions,
    shares: [],
    ...overrides,
  };
}

function input(overrides: Partial<PeriodHistoryInput> = {}): PeriodHistoryInput {
  return {
    today: '2026-09-15',
    current: periodInput('2026-09'),
    references: [],
    ...overrides,
  };
}

test('builds daily own spending, income, unknowns, and a current cutoff', () => {
  const result = computePeriodHistory(input({
    current: periodInput('2026-09', [
      transaction({ id: 'day-one', direction: 'expense', status: 'complete', amount: 100 }),
      transaction({ id: 'known-draft', direction: 'expense', status: 'draft', amount: 50, occurredOn: '2026-09-10' }),
      transaction({ id: 'unknown', direction: 'expense', status: 'draft', amount: null, occurredOn: '2026-09-12', group: null, leaf: null }),
      transaction({ id: 'split', direction: 'expense', status: 'complete', amount: 1_000, occurredOn: '2026-09-14' }),
      transaction({ id: 'income', direction: 'income', status: 'complete', amount: 500, occurredOn: '2026-09-15', group: null, leaf: null }),
      transaction({ id: 'today', direction: 'expense', status: 'complete', amount: 300, occurredOn: '2026-09-15' }),
      transaction({ id: 'transfer', direction: 'transfer', status: 'complete', amount: 800, occurredOn: '2026-09-11', group: null, leaf: null }),
      transaction({ id: 'adjustment', direction: 'adjustment', status: 'complete', amount: 900, occurredOn: '2026-09-13', group: null, leaf: null }),
      transaction({ id: 'transfer-draft', direction: 'transfer', status: 'draft', amount: null, occurredOn: '2026-09-12', group: null, leaf: null }),
      transaction({ id: 'adjustment-draft', direction: 'adjustment', status: 'draft', amount: null, occurredOn: '2026-09-12', group: null, leaf: null }),
      transaction({ id: 'future', direction: 'expense', status: 'complete', amount: 700, occurredOn: '2026-09-16' }),
    ], {
      monthConfig: {
        period: '2026-09',
        openingBalance: 3_000,
        incomeTotal: 0,
        reservedTotal: 0,
        horizonDate: '2026-09-30',
      },
      shares: [
        { transactionId: 'split', contactId: null, shareAmount: 250 },
        { transactionId: 'split', contactId: 'contact', shareAmount: 750 },
      ],
    }),
  }));

  assert.equal(result.perDay, 103);
  assert.equal(result.cutoffDay, 15);
  assert.equal(result.actualPoints.length, 15);
  assert.equal(result.actualPoints[14]?.amount, 700);
  assert.equal(result.days.length, 30);
  assert.deepEqual(result.days[0], {
    date: '2026-09-01',
    day: 1,
    phase: 'elapsed',
    spend: 100,
    income: 0,
    spendStep: 2,
    unknownDrafts: 0,
    transactions: [{ id: 'day-one', direction: 'expense', status: 'complete', amount: 100, label: 'Groceries' }],
  });
  assert.equal(result.days[9]?.spend, 50);
  assert.equal(result.days[9]?.spendStep, 1);
  assert.equal(result.days[11]?.unknownDrafts, 1);
  assert.equal(result.days[11]?.transactions[0]?.amount, null);
  assert.equal(result.days[13]?.spend, 250);
  assert.equal(result.days[13]?.transactions[0]?.amount, 250);
  assert.equal(result.days[14]?.phase, 'today');
  assert.equal(result.days[14]?.income, 500);
  assert.equal(result.days[14]?.spend, 300);
  assert.equal(result.days[15]?.phase, 'future');
  assert.equal(result.days[15]?.spend, 0);
  assert.equal(result.days[15]?.transactions.length, 0);
  assert.equal(result.days[10]?.transactions.length, 0);
});

test('uses deterministic ramp boundaries against the stored per-day value', () => {
  const result = computePeriodHistory(input({
    today: '2026-09-30',
    current: periodInput('2026-09', [
      transaction({ id: 'half', direction: 'expense', status: 'complete', amount: 50 }),
      transaction({ id: 'one', direction: 'expense', status: 'complete', amount: 100, occurredOn: '2026-09-02' }),
      transaction({ id: 'two', direction: 'expense', status: 'complete', amount: 200, occurredOn: '2026-09-03' }),
      transaction({ id: 'over-two', direction: 'expense', status: 'complete', amount: 201, occurredOn: '2026-09-04' }),
    ], {
      monthConfig: {
        period: '2026-09',
        openingBalance: 2_900,
        incomeTotal: 0,
        reservedTotal: 0,
        horizonDate: '2026-09-30',
      },
    }),
  }));

  assert.equal(result.perDay, 100);
  assert.deepEqual(
    result.days.slice(0, 4).map(({ spend, spendStep }) => ({ spend, spendStep })),
    [
      { spend: 50, spendStep: 1 },
      { spend: 100, spendStep: 2 },
      { spend: 200, spendStep: 3 },
      { spend: 201, spendStep: 4 },
    ]
  );
});

test('uses reference medians at each day and labels the sample size honestly', () => {
  const references = [
    periodInput('2026-06', [
      transaction({ id: 'june-one', direction: 'expense', status: 'complete', amount: 75, occurredOn: '2026-06-01' }),
      transaction({ id: 'june-fifteen', direction: 'expense', status: 'complete', amount: 200, occurredOn: '2026-06-15' }),
    ]),
    periodInput('2026-07', [
      transaction({ id: 'july-one', direction: 'expense', status: 'complete', amount: 50, occurredOn: '2026-07-01' }),
      transaction({ id: 'july-fifteen', direction: 'expense', status: 'complete', amount: 500, occurredOn: '2026-07-15' }),
    ]),
    periodInput('2026-08', [
      transaction({ id: 'august-one', direction: 'expense', status: 'complete', amount: 100, occurredOn: '2026-08-01' }),
      transaction({ id: 'august-fifteen', direction: 'expense', status: 'complete', amount: 300, occurredOn: '2026-08-15' }),
    ]),
    periodInput('2026-10', [
      transaction({ id: 'future-reference', direction: 'expense', status: 'complete', amount: 999, occurredOn: '2026-10-01' }),
    ]),
  ];

  const result = computePeriodHistory(input({
    current: periodInput('2026-09', [
      transaction({ id: 'current-one', direction: 'expense', status: 'complete', amount: 100 }),
      transaction({ id: 'current-fifteen', direction: 'expense', status: 'complete', amount: 300, occurredOn: '2026-09-15' }),
    ]),
    references,
  }));

  assert.equal(result.reference.status, 'available');
  if (result.reference.status === 'available') {
    assert.equal(result.reference.label, 'usual');
    assert.equal(result.reference.sampleCount, 3);
  }
  if (result.reference.status !== 'available') throw new Error('reference missing');
  assert.equal(result.reference.points[0]?.amount, 75);
  assert.equal(result.reference.points[14]?.amount, 400);
  assert.deepEqual(result.gap, { relation: 'equal', amount: 0, day: 15 });
});

test('floors even medians, carries short periods, and names one reference period', () => {
  const one = computePeriodHistory(input({
    current: periodInput('2026-09'),
    references: [periodInput('2026-02', [
      transaction({ id: 'february', direction: 'expense', status: 'complete', amount: 101, occurredOn: '2026-02-28' }),
    ])],
  }));
  assert.equal(one.reference.status, 'available');
  if (one.reference.status === 'available') {
    assert.equal(one.reference.label, 'February 2026');
    assert.equal(one.reference.points[27]?.amount, 101);
    assert.equal(one.reference.points[28]?.amount, 101);
    assert.equal(one.reference.points[29]?.amount, 101);
  }

  const two = computePeriodHistory(input({
    current: periodInput('2026-09'),
    references: [
      periodInput('2026-07', [transaction({ id: 'july', direction: 'expense', status: 'complete', amount: 101, occurredOn: '2026-07-01' })]),
      periodInput('2026-08', [transaction({ id: 'august', direction: 'expense', status: 'complete', amount: 102, occurredOn: '2026-08-01' })]),
    ],
  }));
  assert.equal(two.reference.status, 'available');
  if (two.reference.status === 'available') {
    assert.equal(two.reference.label, '2-period median');
    assert.equal(two.reference.points[0]?.amount, 101);
  }
});

test('keeps zero spending untinted and makes positive spending explicit with no threshold', () => {
  const result = computePeriodHistory(input({
    current: periodInput('2026-09', [
      transaction({ id: 'expense', direction: 'expense', status: 'complete', amount: 1 }),
    ], {
      monthConfig: {
        period: '2026-09',
        openingBalance: 0,
        incomeTotal: 0,
        reservedTotal: 0,
        horizonDate: '2026-09-01',
      },
    }),
  }));

  assert.equal(result.perDay, null);
  assert.equal(result.days[0]?.spendStep, 4);
  assert.equal(result.days[1]?.spendStep, 0);
});

test('returns no reference and does not mutate its input', () => {
  const original = input({
    current: periodInput('2026-09', [
      transaction({ id: 'expense', direction: 'expense', status: 'complete', amount: 101 }),
    ]),
  });
  const before = JSON.stringify(original);
  const first = computePeriodHistory(original);
  const second = computePeriodHistory(original);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(first.reference, { status: 'none' });
  assert.equal(first.gap, null);
});
