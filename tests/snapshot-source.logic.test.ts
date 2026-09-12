import { strict as assert } from 'node:assert';

import type { AccountBalance } from '../src/data/accounts';
import type { MonthConfig } from '../src/data/month-config-validation';
import type { LedgerShare } from '../src/data/shares';
import type { Transaction } from '../src/data/transaction-validation';
import { readBudgetInput, type BudgetSnapshotReads } from '../src/budget/snapshot-source';

const storedConfig: MonthConfig = {
  period: '2026-09',
  openingBalance: 4_000_000,
  incomeTotal: 2_000_000,
  reservedTotal: 900_000,
  horizonDate: '2026-09-28',
};

function transaction(
  status: 'complete' | 'draft',
  amount: number | null,
  date: Date
): Transaction {
  const common = {
    id: status === 'complete' ? 'complete-transaction' : 'unknown-draft',
    accountId: 'bank-account',
    direction: 'expense' as const,
    adjustmentEffect: null,
    amount,
    categoryId: 'food-leaf',
    quality: null,
    payer: { kind: 'you' as const },
    occurredAt: date,
    photoKey: null,
    note: null,
    sourceLabel: null,
    createdAt: date,
    updatedAt: date,
    deletedAt: null,
  };
  if (status === 'complete') {
    if (amount === null) {
      throw new Error('Complete test transaction requires an amount');
    }
    return { ...common, status: 'complete', amount };
  }
  return { ...common, status: 'draft', amount };
}

function readsFor(options: {
  config?: MonthConfig;
  accounts?: AccountBalance[];
  shares?: LedgerShare[];
  transactions?: Transaction[];
  reservedUnpaid?: number;
} = {}): {
  reads: BudgetSnapshotReads;
  calls: {
    configPeriods: unknown[];
    reservePeriods: unknown[];
    accountReads: number;
    transactionReads: number;
    shareReads: number;
  };
} {
  const calls = {
    configPeriods: [] as unknown[],
    reservePeriods: [] as unknown[],
    accountReads: 0,
    transactionReads: 0,
    shareReads: 0,
  };
  const reads: BudgetSnapshotReads = {
    accounts: {
      readAccountBalances: async () => {
        calls.accountReads += 1;
        return options.accounts ?? [];
      },
    },
    commitments: {
      readReservedUnpaid: async (period: unknown) => {
        calls.reservePeriods.push(period);
        return options.reservedUnpaid ?? 0;
      },
    },
    monthConfig: {
      readMonthConfig: async (period: unknown) => {
        calls.configPeriods.push(period);
        return options.config;
      },
    },
    transactions: {
      readTransactions: async () => {
        calls.transactionReads += 1;
        return options.transactions ?? [];
      },
    },
    shares: {
      readShares: async () => {
        calls.shareReads += 1;
        return options.shares ?? [];
      },
    },
  };
  return { reads, calls };
}

test('reads the stored current config and all budget source values', async () => {
  const { reads, calls } = readsFor({
    config: storedConfig,
    accounts: [
      { accountId: 'bank-account', name: 'Bank', kind: 'bank', isDefault: true, openingBalance: 0, balance: 1_250_000 },
      { accountId: 'cash-account', name: 'Cash', kind: 'cash', isDefault: false, openingBalance: 0, balance: 300_000 },
    ],
    reservedUnpaid: 275_000,
  });

  const input = await readBudgetInput(reads, new Date(2026, 8, 15, 9, 30, 0));

  assert.deepEqual(input.monthConfig, {
    period: '2026-09',
    horizonDate: '2026-09-28',
  });
  assert.deepEqual(input.accountBalances, [1_250_000, 300_000]);
  assert.equal(input.reservedUnpaid, 275_000);
  assert.deepEqual(calls.configPeriods, ['2026-09']);
  assert.deepEqual(calls.reservePeriods, ['2026-09']);
  assert.equal(calls.accountReads, 1);
  assert.equal(calls.transactionReads, 1);
  assert.equal(calls.shareReads, 1);
  assert.deepEqual(input.shares, []);
  assert.equal(input.owedToYou, 0);
});

test('maps local dates and preserves complete amounts and unknown draft nulls', async () => {
  const completeDate = new Date(2026, 8, 14, 23, 59, 0);
  const draftDate = new Date(2026, 8, 15, 0, 1, 0);
  const { reads } = readsFor({
    config: storedConfig,
    transactions: [
      transaction('complete', 88_000, completeDate),
      transaction('draft', null, draftDate),
    ],
  });

  const input = await readBudgetInput(reads, new Date(2026, 8, 15, 12, 0, 0));

  assert.equal(input.today, '2026-09-15');
  assert.deepEqual(input.transactions, [
    {
      id: 'complete-transaction',
      direction: 'expense',
      payer: { kind: 'you' },
      quality: null,
      occurredOn: '2026-09-14',
      status: 'complete',
      amount: 88_000,
    },
    {
      id: 'unknown-draft',
      direction: 'expense',
      payer: { kind: 'you' },
      quality: null,
      occurredOn: '2026-09-15',
      status: 'draft',
      amount: null,
    },
  ]);
});

test('maps active share rows into the budget input', async () => {
  const { reads } = readsFor({
    config: storedConfig,
    shares: [
      { transactionId: 'complete-transaction', contactId: null, shareAmount: 40_000 },
      {
        transactionId: 'complete-transaction',
        contactId: 'contact-id',
        shareAmount: 48_000,
      },
    ],
  });

  const input = await readBudgetInput(reads, new Date(2026, 8, 15, 12, 0, 0));

  assert.deepEqual(input.shares, [
    { transactionId: 'complete-transaction', contactId: null, shareAmount: 40_000 },
    { transactionId: 'complete-transaction', contactId: 'contact-id', shareAmount: 48_000 },
  ]);
});

test('reports an explicit error when the current period has no stored config', async () => {
  const { reads, calls } = readsFor();

  await assert.rejects(
    readBudgetInput(reads, new Date(2026, 8, 15, 12, 0, 0)),
    /Current period 2026-09 has no stored month config/
  );
  assert.deepEqual(calls.configPeriods, ['2026-09']);
  assert.equal(calls.accountReads, 0);
  assert.equal(calls.transactionReads, 0);
  assert.deepEqual(calls.reservePeriods, []);
});
