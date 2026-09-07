/**
 * Pure account balance arithmetic.
 *
 * The database stores opening balances and ledger rows, not running totals.
 * BigInt keeps a large intermediate sum exact before the public API returns a
 * safe integer number. Adjustment polarity belongs to DATA-007, so seeing one
 * here fails closed instead of guessing which way the balance should move.
 */
import {
  assertNonNegativeVndAmount,
  assertPositiveVndAmount,
  MAX_VND_AMOUNT,
} from '../money/currency';

const MAX_SAFE_BALANCE = BigInt(MAX_VND_AMOUNT);

export type BalanceAccount = {
  accountId: string;
  openingBalance: number;
};

export type BalanceTransaction = {
  accountId: string;
  direction: 'expense' | 'income' | 'adjustment' | 'transfer';
  amount: number | null;
};

export type BalanceTransfer = {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
};

export type AccountBalanceInput = {
  accounts: readonly BalanceAccount[];
  transactions: readonly BalanceTransaction[];
  transfers: readonly BalanceTransfer[];
};

export type DerivedAccountBalance = {
  accountId: string;
  balance: number;
};

function addEffect(
  balances: Map<string, bigint>,
  accountId: string,
  amount: number,
  effect: 'increase' | 'decrease'
): void {
  assertPositiveVndAmount(amount);
  const current = balances.get(accountId);
  if (current === undefined) {
    throw new Error(`Unknown account ${accountId}`);
  }
  const delta = BigInt(amount);
  balances.set(accountId, effect === 'increase' ? current + delta : current - delta);
}

function toSafeBalance(accountId: string, value: bigint): number {
  if (value < -MAX_SAFE_BALANCE || value > MAX_SAFE_BALANCE) {
    throw new RangeError(`Balance for account ${accountId} exceeds the safe integer range`);
  }
  return Number(value);
}

export function deriveAccountBalances(
  input: AccountBalanceInput
): DerivedAccountBalance[] {
  const balances = new Map<string, bigint>();

  for (const account of input.accounts) {
    if (balances.has(account.accountId)) {
      throw new Error(`Duplicate account ${account.accountId}`);
    }
    assertNonNegativeVndAmount(account.openingBalance, 'openingBalance');
    balances.set(account.accountId, BigInt(account.openingBalance));
  }

  for (const transaction of input.transactions) {
    if (transaction.amount === null) {
      continue;
    }
    if (transaction.direction === 'adjustment') {
      throw new Error('Adjustment polarity is not defined for account balances');
    }
    if (transaction.direction === 'transfer') {
      continue;
    }
    addEffect(
      balances,
      transaction.accountId,
      transaction.amount,
      transaction.direction === 'income' ? 'increase' : 'decrease'
    );
  }

  for (const transfer of input.transfers) {
    if (transfer.fromAccountId === transfer.toAccountId) {
      throw new Error('A transfer must use two different accounts');
    }
    addEffect(balances, transfer.fromAccountId, transfer.amount, 'decrease');
    addEffect(balances, transfer.toAccountId, transfer.amount, 'increase');
  }

  return input.accounts.map((account) => {
    const balance = balances.get(account.accountId);
    if (balance === undefined) {
      throw new Error(`Unknown account ${account.accountId}`);
    }
    return {
      accountId: account.accountId,
      balance: toSafeBalance(account.accountId, balance),
    };
  });
}
