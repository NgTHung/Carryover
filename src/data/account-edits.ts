/**
 * Atomically saves account details and opening-balance corrections.
 *
 * Period preparation and the account update share one SQLite transaction, so
 * a new period cannot capture the post-edit opening balance as its baseline.
 */
import { and, eq } from 'drizzle-orm';

import {
  createDefaultAtomicRunner,
  type AtomicTransactionRunner,
  type LedgerDatabase,
} from './atomic';
import {
  editAccountDetailsSchema,
  updateAccountOpeningBalanceSchema,
} from './account-validation';
import { readAccountBalances } from './account-projection';
import {
  ledgerChangeNotifier,
  type LedgerChangeNotifier,
} from './ledger-change-notifier';
import { safeSignedVnd } from './period-income';
import {
  prepareCurrentPeriodInTransaction,
  type PeriodPreparationMutation,
} from './period-preparation';
import { accounts } from './schema';
import { activeRowFilter } from './soft-delete';

export type AccountEditOptions<TResultKind extends 'sync' | 'async'> = {
  runAtomic?: AtomicTransactionRunner<TResultKind>;
  now?: () => Date;
};

type AccountEdit = {
  accountId: string;
  name?: string;
  openingBalance: number;
};

type AccountMutationResult = {
  changed: boolean;
  periodMutation: PeriodPreparationMutation;
};

function accountNotFound(accountId: string): Error {
  return new Error(`Active account ${accountId} was not found`);
}

function accountChanged(accountId: string): Error {
  return new Error(`Account ${accountId} changed during account edit`);
}

function updatedAtAfter(previous: Date, at: Date): Date {
  return new Date(Math.max(at.getTime(), previous.getTime() + 1));
}

function assertCombinedBalanceIsSafe(
  balances: readonly { balance: number }[]
): void {
  const total = balances.reduce(
    (sum, account) => sum + BigInt(account.balance),
    0n
  );
  safeSignedVnd(total, 'combined account balance');
}

async function saveAccountEditInTransaction<
  TResultKind extends 'sync' | 'async',
>(
  db: LedgerDatabase<TResultKind>,
  input: AccountEdit,
  at: Date
): Promise<AccountMutationResult> {
  const existing = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      openingBalance: accounts.openingBalance,
      updatedAt: accounts.updatedAt,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.id, input.accountId),
        activeRowFilter(accounts.deletedAt)
      )
    )
    .get();
  if (existing === undefined) {
    throw accountNotFound(input.accountId);
  }

  const nextName = input.name ?? existing.name;
  if (
    existing.name === nextName &&
    existing.openingBalance === input.openingBalance
  ) {
    return { changed: false, periodMutation: 'none' };
  }

  const preparation = await prepareCurrentPeriodInTransaction(db, at);
  const updated = await db
    .update(accounts)
    .set({
      name: nextName,
      openingBalance: input.openingBalance,
      updatedAt: updatedAtAfter(existing.updatedAt, at),
    })
    .where(
      and(
        eq(accounts.id, input.accountId),
        eq(accounts.updatedAt, existing.updatedAt),
        activeRowFilter(accounts.deletedAt)
      )
    )
    .returning()
    .get();
  if (updated === undefined) {
    throw accountChanged(input.accountId);
  }

  const balances = await readAccountBalances(db);
  assertCombinedBalanceIsSafe(balances);
  return { changed: true, periodMutation: preparation.mutation };
}

function notifyAccountEdit(
  changeNotifier: LedgerChangeNotifier,
  result: AccountMutationResult
): void {
  if (!result.changed) return;
  changeNotifier.notify({ table: 'accounts', mutation: 'edited' });
  if (result.periodMutation !== 'none') {
    changeNotifier.notify({
      table: 'month_config',
      mutation: result.periodMutation === 'created' ? 'created' : 'edited',
    });
  }
}

export function createAccountEdits<TResultKind extends 'sync' | 'async'>(
  db: LedgerDatabase<TResultKind>,
  changeNotifier: LedgerChangeNotifier = ledgerChangeNotifier,
  options: AccountEditOptions<TResultKind> = {}
) {
  const runAtomic = options.runAtomic ?? createDefaultAtomicRunner(db);
  const now = options.now ?? (() => new Date());

  async function save(input: AccountEdit): Promise<void> {
    const at = now();
    const result = await runAtomic((transactionDb) =>
      saveAccountEditInTransaction(transactionDb, input, at)
    );
    notifyAccountEdit(changeNotifier, result);
  }

  return {
    async editAccountDetails(input: unknown): Promise<void> {
      const parsed = editAccountDetailsSchema.parse(input);
      await save(parsed);
    },

    async updateOpeningBalance(input: unknown): Promise<void> {
      const parsed = updateAccountOpeningBalanceSchema.parse(input);
      await save(parsed);
    },
  };
}
