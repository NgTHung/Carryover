import { strict as assert } from 'node:assert';

import {
  currentPeriod,
  formatPeriod,
  periodBounds,
  periodSchema,
  shiftPeriod,
} from '../src/data/period';
import { createLedgerChangeNotifier } from '../src/data/ledger-change-notifier';
import { createTransactionFilterStore } from '../src/ui/transactions/transaction-filters';

test('period schema and bounds use local calendar months', () => {
  assert.equal(periodSchema.safeParse('2026-02').success, true);
  assert.equal(periodSchema.safeParse('2026-2').success, false);
  assert.equal(periodSchema.safeParse('2026-13').success, false);

  const { start, end } = periodBounds('2026-02');
  assert.equal(start.getFullYear(), 2026);
  assert.equal(start.getMonth(), 1);
  assert.equal(start.getDate(), 1);
  assert.equal(start.getHours(), 0);
  assert.equal(end.getFullYear(), 2026);
  assert.equal(end.getMonth(), 2);
  assert.equal(end.getDate(), 1);
  assert.equal(end.getHours(), 0);
  assert.equal(currentPeriod(new Date(2026, 8, 9, 23, 59)), '2026-09');
  assert.equal(shiftPeriod('2026-01', -1), '2025-12');
  assert.equal(shiftPeriod('2026-12', 1), '2027-01');
  assert.equal(formatPeriod('2026-09'), 'September 2026');
});

test('transaction filter store keeps only choices and resets them', () => {
  const store = createTransactionFilterStore('2026-02');
  store.getState().setCategoryId('11111111-1111-4111-8111-111111111111');
  store.getState().setAccountId('22222222-2222-4222-8222-222222222222');
  store.getState().setQuality('unrated');
  store.getState().setSelectedPeriod('2026-03');

  assert.deepEqual(
    {
      selectedPeriod: store.getState().selectedPeriod,
      categoryId: store.getState().categoryId,
      accountId: store.getState().accountId,
      quality: store.getState().quality,
    },
    {
      selectedPeriod: '2026-03',
      categoryId: '11111111-1111-4111-8111-111111111111',
      accountId: '22222222-2222-4222-8222-222222222222',
      quality: 'unrated',
    }
  );

  store.getState().reset();
  assert.equal(store.getState().selectedPeriod, currentPeriod());
  assert.equal(store.getState().categoryId, null);
  assert.equal(store.getState().accountId, null);
  assert.equal(store.getState().quality, null);
  assert.equal('transactions' in store.getState(), false);
});

test('revealTransaction selects the saved local period and clears filters atomically', () => {
  const store = createTransactionFilterStore('2026-02');
  store.setState({
    categoryId: '11111111-1111-4111-8111-111111111111',
    accountId: '22222222-2222-4222-8222-222222222222',
    quality: 'regret',
  });
  let updates = 0;
  const unsubscribe = store.subscribe(() => {
    updates += 1;
  });

  store.getState().revealTransaction(new Date(2025, 11, 31, 23, 59));

  unsubscribe();
  assert.deepEqual(
    {
      selectedPeriod: store.getState().selectedPeriod,
      categoryId: store.getState().categoryId,
      accountId: store.getState().accountId,
      quality: store.getState().quality,
    },
    {
      selectedPeriod: '2025-12',
      categoryId: null,
      accountId: null,
      quality: null,
    }
  );
  assert.equal(updates, 1);
});

test('notifier reports listener errors without throwing from notify', () => {
  const errors: Array<{ error: unknown; table: string }> = [];
  const notifier = createLedgerChangeNotifier({
    onListenerError: (error, change) => errors.push({ error, table: change.table }),
  });
  notifier.subscribe(() => {
    throw new Error('view failed');
  });

  assert.doesNotThrow(() =>
    notifier.notify({ table: 'transactions', mutation: 'edited' })
  );
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.table, 'transactions');
  assert.equal((errors[0]?.error as Error).message, 'view failed');
});
