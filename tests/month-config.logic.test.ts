import { strict as assert } from 'node:assert';

import { dateOnlySchema } from '../src/data/date-only';
import {
  monthConfigSchema,
  openPeriodInputSchema,
  updateHorizonInputSchema,
} from '../src/data/month-config-validation';
import {
  PERIOD_START_DAY,
  periodBounds,
  periodEndDate,
  periodStartDate,
} from '../src/data/period';

test('date-only validation accepts real calendar dates only', () => {
  for (const value of ['2026-01-01', '2024-02-29', '2026-12-31']) {
    assert.equal(dateOnlySchema.safeParse(value).success, true);
  }

  for (const value of [
    '2026-1-01',
    '2026-01-1',
    '2026-02-29',
    '2025-02-29',
    '2026-04-31',
    '2026-00-01',
    '2026-13-01',
    '2026-01-00',
    '2026-01-32',
    '2026-01-01T00:00:00.000Z',
  ]) {
    assert.equal(dateOnlySchema.safeParse(value).success, false, value);
  }
});

test('period boundaries use the configured first day and local calendar dates', () => {
  assert.equal(PERIOD_START_DAY, 1);
  assert.equal(periodStartDate('2026-02'), '2026-02-01');
  assert.equal(periodEndDate('2026-02'), '2026-02-28');
  assert.equal(periodEndDate('2024-02'), '2024-02-29');
  assert.equal(periodEndDate('2026-04'), '2026-04-30');
  assert.equal(periodEndDate('2026-12'), '2026-12-31');

  const bounds = periodBounds('2026-02');
  assert.equal(bounds.start.getDate(), PERIOD_START_DAY);
  assert.equal(bounds.start.getMonth(), 1);
  assert.equal(bounds.end.getDate(), PERIOD_START_DAY);
  assert.equal(bounds.end.getMonth(), 2);
});

test('month config schema requires a strict snapshot and valid horizon', () => {
  const config = monthConfigSchema.parse({
    period: '2026-02',
    openingBalance: 1_000_000,
    incomeTotal: 2_000_000,
    reservedTotal: 300_000,
    horizonDate: '2026-03-15',
  });
  assert.deepEqual(config, {
    period: '2026-02',
    openingBalance: 1_000_000,
    incomeTotal: 2_000_000,
    reservedTotal: 300_000,
    horizonDate: '2026-03-15',
  });

  assert.throws(() =>
    monthConfigSchema.parse({ ...config, horizonDate: '2026-01-31' })
  );
  assert.throws(() => monthConfigSchema.parse({ ...config, extra: true }));
  assert.throws(() =>
    monthConfigSchema.parse({ ...config, openingBalance: 12.5 })
  );
});

test('malformed periods remain safe validation failures', () => {
  assert.equal(
    monthConfigSchema.safeParse({
      period: '2026-9',
      openingBalance: 1_000,
      incomeTotal: 2_000,
      reservedTotal: 500,
      horizonDate: '2026-09-30',
    }).success,
    false
  );
  assert.equal(
    openPeriodInputSchema.safeParse({
      period: '2026-9',
      openingBalance: 1_000,
      incomeTotal: 2_000,
      reservedTotal: 500,
      horizonDate: '2026-09-30',
    }).success,
    false
  );
  assert.equal(
    updateHorizonInputSchema.safeParse({
      period: '2026-9',
      horizonDate: '2026-09-30',
    }).success,
    false
  );
});

test('opening a period defaults horizon to period end and accepts zero totals', () => {
  assert.deepEqual(
    openPeriodInputSchema.parse({
      period: '2026-02',
      openingBalance: 0,
      incomeTotal: 0,
      reservedTotal: 0,
    }),
    {
      period: '2026-02',
      openingBalance: 0,
      incomeTotal: 0,
      reservedTotal: 0,
      horizonDate: '2026-02-28',
    }
  );

  assert.deepEqual(
    openPeriodInputSchema.parse({
      period: '2024-02',
      openingBalance: 100,
      incomeTotal: 200,
      reservedTotal: 300,
      horizonDate: '2024-03-31',
    }).horizonDate,
    '2024-03-31'
  );
});

test('opening and editing horizon inputs are strict and reject invalid money or dates', () => {
  const input = {
    period: '2026-09',
    openingBalance: 1_000,
    incomeTotal: 2_000,
    reservedTotal: 500,
  };

  for (const invalid of [
    { ...input, openingBalance: -1 },
    { ...input, incomeTotal: 1.5 },
    { ...input, reservedTotal: '500' },
    { ...input, horizonDate: '2026-08-31' },
    { ...input, extra: true },
  ]) {
    assert.throws(() => openPeriodInputSchema.parse(invalid));
  }

  assert.throws(() =>
    updateHorizonInputSchema.parse({
      period: '2026-09',
      horizonDate: '2026-08-31',
    })
  );
  assert.throws(() =>
    updateHorizonInputSchema.parse({
      period: '2026-09',
      horizonDate: '2026-09-31',
    })
  );
  assert.throws(() =>
    updateHorizonInputSchema.parse({
      period: '2026-09',
      horizonDate: '2026-09-30',
      extra: true,
    })
  );
  assert.deepEqual(
    updateHorizonInputSchema.parse({
      period: '2026-09',
      horizonDate: '2027-01-01',
    }),
    { period: '2026-09', horizonDate: '2027-01-01' }
  );
});
