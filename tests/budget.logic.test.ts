import { strict as assert } from 'node:assert';

import {
  computeBudget,
  type BudgetInput,
  type BudgetTransaction,
} from '../src/budget/snapshot';

const you = { kind: 'you' } as const;
const contact = {
  kind: 'contact',
  contactId: '33333333-3333-4333-8333-333333333333',
} as const;

function input(overrides: Partial<BudgetInput> = {}): BudgetInput {
  return {
    today: '2026-09-15',
    updatedAt: '2026-09-15T12:00:00.000Z',
    monthConfig: { period: '2026-09', horizonDate: '2026-09-30' },
    accountBalances: [1_250_000],
    reservedUnpaid: 250_000,
    transactions: [],
    shares: [],
    owedToYou: 0,
    ...overrides,
  };
}

function transaction(
  overrides: Partial<BudgetTransaction> &
    Pick<BudgetTransaction, 'id' | 'direction' | 'status' | 'amount'>
): BudgetTransaction {
  return {
    payer: you,
    quality: null,
    occurredOn: '2026-09-15',
    ...overrides,
  } as BudgetTransaction;
}

test('computes the complete snapshot and is deterministic without mutating input', () => {
  const budgetInput = input({
    accountBalances: [1_000_000, 250_000],
    owedToYou: 45_000,
    transactions: [
      transaction({
        id: 'expense',
        status: 'complete',
        direction: 'expense',
        amount: 101,
        quality: 'regret',
      }),
    ],
  });
  const original = JSON.stringify(budgetInput);
  const first = computeBudget(budgetInput);
  const second = computeBudget(budgetInput);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(budgetInput), original);
  assert.equal(first.balanceTotal, 1_250_000);
  assert.equal(first.reservedUnpaid, 250_000);
  assert.equal(first.discretionary, 1_000_000);
  assert.equal(first.horizonDate, '2026-09-30');
  assert.equal(first.daysToHorizon, 15);
  assert.equal(first.perDay, 66_666);
  assert.equal(first.spentThisMonth, 101);
  assert.equal(first.regrettedThisMonth, 101);
  assert.equal(first.owedToYou, 45_000);
  assert.equal(first.updatedAt, budgetInput.updatedAt);
});

test('returns null per day at a zero-day horizon and floors negative division', () => {
  const zeroDays = computeBudget(input({
    today: '2026-09-30',
    accountBalances: [0],
    reservedUnpaid: 1,
  }));
  assert.equal(zeroDays.daysToHorizon, 0);
  assert.equal(zeroDays.perDay, null);

  const elapsed = computeBudget(input({ today: '2026-10-01' }));
  assert.equal(elapsed.daysToHorizon, 0);
  assert.equal(elapsed.perDay, null);

  const negative = computeBudget(input({
    accountBalances: [0],
    reservedUnpaid: 101,
    monthConfig: { period: '2026-09', horizonDate: '2026-09-20' },
  }));
  assert.equal(negative.discretionary, -101);
  assert.equal(negative.perDay, -21);
});

test('returns null runway for zero burn and zero for nonpositive discretionary', () => {
  assert.equal(computeBudget(input()).runwayDays, null);
  assert.equal(
    computeBudget(input({ accountBalances: [0], reservedUnpaid: 1 })).runwayDays,
    0
  );
  assert.equal(
    computeBudget(input({
      accountBalances: [0],
      reservedUnpaid: 1,
      transactions: [
        transaction({ id: 'expense', status: 'complete', direction: 'expense', amount: 100 }),
      ],
    })).runwayDays,
    0
  );
});

test('counts own split share, not the full transaction amount', () => {
  const result = computeBudget(input({
    transactions: [
      transaction({
        id: 'split',
        status: 'complete',
        direction: 'expense',
        amount: 1_000,
        payer: you,
      }),
    ],
    shares: [
      { transactionId: 'split', contactId: null, shareAmount: 250 },
      { transactionId: 'split', contactId: contact.contactId, shareAmount: 750 },
    ],
  }));
  assert.equal(result.spentThisMonth, 250);
  assert.equal(result.regrettedThisMonth, 0);
});

test('excludes income, transfers, and adjustments but charges contact-paid spending', () => {
  const result = computeBudget(input({
    transactions: [
      transaction({ id: 'income', status: 'complete', direction: 'income', amount: 500_000 }),
      transaction({ id: 'transfer', status: 'complete', direction: 'transfer', amount: 500_000 }),
      transaction({
        id: 'adjustment',
        status: 'complete',
        direction: 'adjustment',
        amount: 500_000,
      }),
      transaction({
        id: 'contact-paid',
        status: 'complete',
        direction: 'expense',
        amount: 500_000,
        payer: contact,
      }),
    ],
  }));
  assert.equal(result.spentThisMonth, 500_000);
  assert.equal(result.regrettedThisMonth, 0);
});

test('counts known drafts as spending and unknown drafts without treating them as zero', () => {
  const result = computeBudget(input({
    transactions: [
      transaction({ id: 'unknown', status: 'draft', direction: 'expense', amount: null }),
      transaction({
        id: 'known-draft',
        status: 'draft',
        direction: 'expense',
        amount: 500,
        quality: 'regret',
      }),
      transaction({
        id: 'split-draft',
        status: 'draft',
        direction: 'expense',
        amount: 1_000,
      }),
    ],
    shares: [
      { transactionId: 'split-draft', contactId: null, shareAmount: 300 },
      {
        transactionId: 'split-draft',
        contactId: contact.contactId,
        shareAmount: 700,
      },
    ],
  }));
  assert.equal(result.unloggedDrafts, 1);
  assert.equal(result.spentThisMonth, 800);
  assert.equal(result.regrettedThisMonth, 500);
});

test('rejects incomplete, duplicate, and non-exact splits', () => {
  assert.throws(() => computeBudget(input({
    transactions: [
      transaction({ id: 'split', status: 'complete', direction: 'expense', amount: 100 }),
    ],
    shares: [{ transactionId: 'split', contactId: null, shareAmount: 99 }],
  })), /must equal/);
  assert.throws(() => computeBudget(input({
    transactions: [
      transaction({ id: 'split', status: 'complete', direction: 'expense', amount: 100 }),
    ],
    shares: [
      { transactionId: 'split', contactId: null, shareAmount: 50 },
      { transactionId: 'split', contactId: null, shareAmount: 50 },
    ],
  })), /Duplicate participant/);
  assert.throws(() => computeBudget(input({
    transactions: [
      transaction({ id: 'split', status: 'complete', direction: 'expense', amount: 100 }),
    ],
    shares: [
      { transactionId: 'split', contactId: contact.contactId, shareAmount: 100 },
    ],
  })), /missing your share/);
  assert.throws(() => computeBudget(input({
    shares: [
      { transactionId: 'unknown', contactId: null, shareAmount: 100 },
    ],
  })), /unknown transaction/);
});

test('uses the inclusive thirty-day burn window', () => {
  const result = computeBudget(input({
    accountBalances: [3_000],
    reservedUnpaid: 0,
    transactions: [
      transaction({
        id: 'today',
        status: 'complete',
        direction: 'expense',
        amount: 100,
        occurredOn: '2026-09-15',
      }),
      transaction({
        id: 'old',
        status: 'complete',
        direction: 'expense',
        amount: 1_000,
        occurredOn: '2026-08-16',
      }),
      transaction({
        id: 'inside',
        status: 'complete',
        direction: 'expense',
        amount: 200,
        occurredOn: '2026-08-17',
      }),
    ],
  }));
  assert.equal(result.runwayDays, 300);
});

test('keeps empty periods at zero and counts unknown drafts across periods', () => {
  const result = computeBudget(input({
    transactions: [
      transaction({
        id: 'older-unknown',
        status: 'draft',
        direction: 'expense',
        amount: null,
        occurredOn: '2026-08-01',
      }),
    ],
  }));

  assert.equal(result.spentThisMonth, 0);
  assert.equal(result.regrettedThisMonth, 0);
  assert.equal(result.unloggedDrafts, 1);
});

test('handles calendar boundaries without including future burn', () => {
  const result = computeBudget(input({
    today: '2024-03-01',
    monthConfig: { period: '2024-03', horizonDate: '2024-03-31' },
    accountBalances: [3_000],
    reservedUnpaid: 0,
    transactions: [
      transaction({
        id: 'leap-day',
        status: 'complete',
        direction: 'expense',
        amount: 300,
        occurredOn: '2024-02-29',
      }),
      transaction({
        id: 'future',
        status: 'complete',
        direction: 'expense',
        amount: 900,
        occurredOn: '2024-03-02',
      }),
    ],
  }));

  assert.equal(result.daysToHorizon, 30);
  assert.equal(result.spentThisMonth, 900);
  assert.equal(result.runwayDays, 300);
});

test('rejects invalid money, dates, duplicate transactions, and unsafe totals', () => {
  assert.throws(
    () => computeBudget(input({ accountBalances: [0.5] })),
    /integer VND/
  );
  assert.throws(
    () => computeBudget(input({ today: '2026-02-31' })),
    /valid date-only/
  );
  assert.throws(
    () => computeBudget(input({
      transactions: [
        transaction({ id: 'same', status: 'complete', direction: 'expense', amount: 1 }),
        transaction({ id: 'same', status: 'complete', direction: 'expense', amount: 1 }),
      ],
    })),
    /Duplicate budget transaction/
  );
  assert.throws(
    () => computeBudget(input({
      accountBalances: [-Number.MAX_SAFE_INTEGER],
      reservedUnpaid: Number.MAX_SAFE_INTEGER,
    })),
    /discretionary exceeds/
  );
});
