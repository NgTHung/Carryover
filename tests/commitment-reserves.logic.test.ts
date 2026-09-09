import { strict as assert } from 'node:assert';

import { MAX_VND_AMOUNT } from '../src/money/currency';
import {
  calculateUnpaidReserve,
  type UnpaidReserveCommitment,
  type UnpaidReservePayment,
} from '../src/data/commitment-reserves';

function commitment(
  id: string,
  amount: number,
  categoryId: string,
  dueDate: string
): UnpaidReserveCommitment {
  return { id, amount, categoryId, dueDate };
}

function payment(
  id: string,
  categoryId: string,
  occurredAt: string
): UnpaidReservePayment {
  return { id, categoryId, occurredAt: new Date(occurredAt) };
}

test('pairs one payment per category by due date and occurrence order', () => {
  const commitments = [
    commitment('later', 2_000, 'rent', '2026-09-20'),
    commitment('earlier', 1_000, 'rent', '2026-09-05'),
    commitment('other', 3_000, 'food', '2026-09-01'),
  ];
  const payments = [
    payment('late-payment', 'rent', '2026-09-18T00:00:00.000Z'),
    payment('early-payment', 'rent', '2026-09-03T00:00:00.000Z'),
    payment('food-payment', 'food', '2026-09-02T00:00:00.000Z'),
  ];

  assert.equal(calculateUnpaidReserve(commitments, payments), 0);
  assert.equal(
    calculateUnpaidReserve(commitments.slice(0, 2), payments.slice(0, 1)),
    2_000
  );
});

test('does not compare payment amount and rejects an unsafe unpaid total', () => {
  assert.equal(
    calculateUnpaidReserve(
      [commitment('commitment', 1_000_000, 'rent', '2026-09-01')],
      [payment('payment', 'rent', '2026-09-01T00:00:00.000Z')]
    ),
    0
  );
  assert.throws(
    () =>
      calculateUnpaidReserve(
        [
          commitment('first', MAX_VND_AMOUNT, 'rent', '2026-09-01'),
          commitment('second', 1, 'rent', '2026-09-02'),
        ],
        []
      ),
    /safe VND amount/i
  );
});
