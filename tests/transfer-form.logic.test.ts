import { strict as assert } from 'node:assert';

import { MAX_VND_AMOUNT } from '../src/money/currency';
import type { ActiveAccount } from '../src/data/accounts';
import {
  buildTransferPayload,
  initializeTransferForm,
  selectFromAccount,
  selectToAccount,
  validateTransferForm,
} from '../src/ui/transfers/transfer-form';

const bankId = '11111111-1111-4111-8111-111111111111';
const cashId = '22222222-2222-4222-8222-222222222222';
const extraId = '33333333-3333-4333-8333-333333333333';
const openedAt = new Date(2026, 8, 15, 12, 30);

const accounts: ActiveAccount[] = [
  { accountId: bankId, name: 'Same name', kind: 'bank', isDefault: true },
  { accountId: cashId, name: 'Same name', kind: 'cash', isDefault: false },
];

test('initializes the fixed pair by kind and default marker, not display name', () => {
  const initialized = initializeTransferForm(accounts, openedAt);
  assert.equal(initialized.status, 'ready');
  if (initialized.status !== 'ready') throw new Error('Expected initialized form');
  assert.deepEqual(initialized.values, {
    amount: '',
    date: '2026-09-15',
    fromAccountId: bankId,
    toAccountId: cashId,
  });

  assert.equal(initializeTransferForm([], openedAt).status, 'error');
  assert.equal(
    initializeTransferForm([
      ...accounts,
      { accountId: extraId, name: 'Another cash', kind: 'cash', isDefault: false },
    ], openedAt).status,
    'error'
  );
});

test('selecting the current destination as source swaps the pair', () => {
  const values = {
    amount: '1000',
    date: '2026-09-15',
    fromAccountId: bankId,
    toAccountId: cashId,
  };
  assert.equal(selectFromAccount(values, cashId).fromAccountId, cashId);
  assert.equal(selectFromAccount(values, cashId).toAccountId, bankId);
  assert.equal(selectToAccount(values, bankId).fromAccountId, cashId);
  assert.equal(selectToAccount(values, bankId).toAccountId, bankId);
});

test('validates whole-dong amounts, local dates, active accounts, and safe maximum', () => {
  const base = {
    amount: '1',
    date: '2026-09-15',
    fromAccountId: bankId,
    toAccountId: cashId,
  };
  const valid = validateTransferForm(base, accounts, openedAt, new Date(2026, 8, 15, 8));
  assert.equal(valid.valid, true);
  if (!valid.valid) throw new Error('Expected valid transfer');
  assert.equal(valid.payload.amount, 1);
  assert.equal(valid.payload.occurredAt.getHours(), 12);

  const maximum = validateTransferForm(
    { ...base, amount: MAX_VND_AMOUNT.toString() },
    accounts,
    openedAt,
    new Date(2026, 8, 15, 8)
  );
  assert.equal(maximum.valid, true);

  for (const amount of ['', '0', '-1', '1.5', '1e3', '1,000', '1 000', `${MAX_VND_AMOUNT}0`]) {
    const invalid = validateTransferForm({ ...base, amount }, accounts, openedAt, new Date(2026, 8, 15, 8));
    assert.equal(invalid.valid, false, amount);
  }

  const tomorrow = validateTransferForm(
    { ...base, date: '2026-09-16' },
    accounts,
    openedAt,
    new Date(2026, 8, 15, 23)
  );
  assert.equal(tomorrow.valid, false);

  const unavailable = validateTransferForm(
    { ...base, fromAccountId: extraId },
    accounts,
    openedAt,
    new Date(2026, 8, 15, 8)
  );
  assert.equal(unavailable.valid, false);
  if (!unavailable.valid) assert.match(unavailable.errors.accounts ?? '', /unavailable/i);

  const same = validateTransferForm(
    { ...base, toAccountId: bankId },
    accounts,
    openedAt,
    new Date(2026, 8, 15, 8)
  );
  assert.equal(same.valid, false);
  if (!same.valid) assert.match(same.errors.accounts ?? '', /different/i);
});

test('builds a strict positive payload without changing the local date anchor', () => {
  const values = {
    amount: '125000',
    date: '2026-09-14',
    fromAccountId: bankId,
    toAccountId: cashId,
  };
  const validation = validateTransferForm(values, accounts, openedAt, openedAt);
  if (!validation.valid) throw new Error('Expected valid transfer');
  assert.deepEqual(buildTransferPayload(values, validation), validation.payload);
  assert.equal(validation.payload.amount, 125_000);
  assert.equal(validation.payload.occurredAt.getHours(), openedAt.getHours());
});
