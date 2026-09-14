import { strict as assert } from 'node:assert';

import { MAX_VND_AMOUNT } from '../src/money/currency';
import {
  calculateUnpaidReserve,
  matchCommitmentReserves,
  summarizeUnpaidReserve,
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
  assert.deepEqual(
    matchCommitmentReserves(commitments, payments).map((match) => ({
      commitmentId: match.commitment.id,
      paymentId: match.status === 'paid' ? match.payment.id : null,
    })),
    [
      { commitmentId: 'other', paymentId: 'food-payment' },
      { commitmentId: 'earlier', paymentId: 'early-payment' },
      { commitmentId: 'later', paymentId: 'late-payment' },
    ]
  );
});

test('clears the lexically earlier commitment when due dates tie regardless of input order', () => {
  const payments = [payment('payment', 'rent', '2026-09-01T00:00:00.000Z')];
  const laterIdCommitment = commitment('b', 2_000, 'rent', '2026-09-01');
  const earlierIdCommitment = commitment('a', 1_000, 'rent', '2026-09-01');

  assert.equal(
    calculateUnpaidReserve([laterIdCommitment, earlierIdCommitment], payments),
    2_000
  );
  assert.equal(
    calculateUnpaidReserve([earlierIdCommitment, laterIdCommitment], payments),
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
  assert.deepEqual(
    summarizeUnpaidReserve(
      matchCommitmentReserves(
        [
          commitment('first', MAX_VND_AMOUNT, 'rent', '2026-09-01'),
          commitment('second', 1, 'rent', '2026-09-02'),
        ],
        []
      )
    ),
    { status: 'overflow' }
  );
});

test('uses transaction ID to break payment timestamp ties without mutating inputs', () => {
  const commitments = [
    commitment('b', 2_000, 'rent', '2026-09-01'),
    commitment('a', 1_000, 'rent', '2026-09-01'),
  ];
  const payments = [
    payment('z', 'rent', '2026-09-01T00:00:00.000Z'),
    payment('a', 'rent', '2026-09-01T00:00:00.000Z'),
  ];
  const commitmentOrder = commitments.map(({ id }) => id);
  const paymentOrder = payments.map(({ id }) => id);

  const matches = matchCommitmentReserves(commitments, payments);

  assert.deepEqual(
    matches.map((match) => [
      match.commitment.id,
      match.status === 'paid' ? match.payment.id : null,
    ]),
    [
      ['a', 'a'],
      ['b', 'z'],
    ]
  );
  assert.deepEqual(commitments.map(({ id }) => id), commitmentOrder);
  assert.deepEqual(payments.map(({ id }) => id), paymentOrder);
});
