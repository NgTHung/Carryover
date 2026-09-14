import { strict as assert } from 'node:assert';

import type { CategoryGroupWithLeaves } from '../src/data/category-types';
import type { Commitment } from '../src/data/commitment-validation';
import { MAX_VND_AMOUNT } from '../src/money/currency';
import {
  buildCommitmentCreateInput,
  buildCommitmentEditInput,
  commitmentActivationError,
  initializeCommitmentCreateForm,
  initializeCommitmentEditForm,
  presentStoredCommitmentLeaf,
  reserveLeafChoices,
  validateCommitmentForm,
  type CommitmentFormValues,
} from '../src/ui/commitments/commitment-form';

const reserveGroupId = '11111111-1111-4111-8111-111111111111';
const reserveLeafId = '22222222-2222-4222-8222-222222222222';
const otherReserveLeafId = '33333333-3333-4333-8333-333333333333';
const spendGroupId = '44444444-4444-4444-8444-444444444444';
const spendLeafId = '55555555-5555-4555-8555-555555555555';
const commitmentId = '66666666-6666-4666-8666-666666666666';

const groups: CategoryGroupWithLeaves[] = [
  {
    level: 'group',
    id: reserveGroupId,
    name: 'Housing',
    sort: 0,
    kind: 'reserve',
    isSuggestion: false,
    deletedAt: null,
    leaves: [
      {
        level: 'leaf',
        id: reserveLeafId,
        name: 'Rent',
        sort: 0,
        kind: 'reserve',
        isSuggestion: false,
        deletedAt: null,
        group: {
          level: 'group', id: reserveGroupId, name: 'Housing', sort: 0, kind: 'reserve',
        },
      },
      {
        level: 'leaf',
        id: otherReserveLeafId,
        name: 'Power',
        sort: 1,
        kind: 'reserve',
        isSuggestion: false,
        deletedAt: null,
        group: {
          level: 'group', id: reserveGroupId, name: 'Housing', sort: 0, kind: 'reserve',
        },
      },
    ],
  },
  {
    level: 'group',
    id: spendGroupId,
    name: 'Food',
    sort: 1,
    kind: 'spend',
    isSuggestion: false,
    deletedAt: null,
    leaves: [{
      level: 'leaf',
      id: spendLeafId,
      name: 'Groceries',
      sort: 0,
      kind: 'spend',
      isSuggestion: false,
      deletedAt: null,
      group: {
        level: 'group', id: spendGroupId, name: 'Food', sort: 1, kind: 'spend',
      },
    }],
  },
];

function commitment(active = true): Commitment {
  return {
    id: commitmentId,
    name: 'Rent',
    amount: 700_000,
    dueDay: 5,
    categoryId: reserveLeafId,
    active,
    createdAt: new Date(2026, 8, 1),
    updatedAt: new Date(2026, 8, 1),
    deletedAt: null,
  };
}

function values(overrides: Partial<CommitmentFormValues> = {}): CommitmentFormValues {
  return {
    name: ' Rent ',
    amount: '700000',
    dueDay: '5',
    categoryId: reserveLeafId,
    ...overrides,
  };
}

test('initializers keep text blank for creation and preserve stored edit values', () => {
  assert.deepEqual(initializeCommitmentCreateForm(), {
    name: '', amount: '', dueDay: '', categoryId: null,
  });
  assert.deepEqual(initializeCommitmentEditForm(commitment()), {
    name: 'Rent', amount: '700000', dueDay: '5', categoryId: reserveLeafId,
  });
});

test('reserve choices exclude spend leaves and never choose a default', () => {
  assert.deepEqual(
    reserveLeafChoices(groups).map(({ id }) => id),
    [reserveLeafId, otherReserveLeafId]
  );
  assert.equal(initializeCommitmentCreateForm().categoryId, null);
});

test('validation trims names and parses positive whole dong and due days', () => {
  const valid = validateCommitmentForm(values(), reserveLeafChoices(groups), {
    status: 'create',
  });
  assert.deepEqual(valid, {
    valid: true,
    name: 'Rent',
    amount: 700_000,
    dueDay: 5,
    categoryId: reserveLeafId,
    errors: {},
  });

  for (const dueDay of ['', '0', '32', '1.5', '-1', '+1', '  ', ' 5 ']) {
    assert.equal(
      validateCommitmentForm(values({ dueDay }), reserveLeafChoices(groups), {
        status: 'create',
      }).valid,
      false
    );
  }
  for (const dueDay of ['1', '31']) {
    assert.equal(
      validateCommitmentForm(values({ dueDay }), reserveLeafChoices(groups), {
        status: 'create',
      }).valid,
      true
    );
  }
  for (const amount of ['', '0', '1.5', '-1', `${MAX_VND_AMOUNT + 1}`]) {
    assert.equal(
      validateCommitmentForm(values({ amount }), reserveLeafChoices(groups), {
        status: 'create',
      }).valid,
      false
    );
  }
});

test('builders return minimal validated create and changed-field edit inputs', () => {
  const choices = reserveLeafChoices(groups);
  const createValidation = validateCommitmentForm(values(), choices, {
    status: 'create',
  });
  if (!createValidation.valid) throw new Error('Expected valid create form');
  assert.deepEqual(buildCommitmentCreateInput(createValidation), {
    name: 'Rent', amount: 700_000, dueDay: 5, categoryId: reserveLeafId,
  });

  const current = commitment();
  const unchanged = validateCommitmentForm(
    initializeCommitmentEditForm(current), choices, { status: 'edit', commitment: current }
  );
  if (!unchanged.valid) throw new Error('Expected valid edit form');
  assert.deepEqual(buildCommitmentEditInput(current, unchanged), {
    commitmentId,
    changes: {},
  });

  const changed = validateCommitmentForm(
    values({ name: ' Rent changed ', amount: '800000' }),
    choices,
    { status: 'edit', commitment: current }
  );
  if (!changed.valid) throw new Error('Expected valid changed form');
  assert.deepEqual(buildCommitmentEditInput(current, changed), {
    commitmentId,
    changes: { name: 'Rent changed', amount: 800_000 },
  });
});

test('unavailable stored leaves stay visible without authorizing active writes', () => {
  const choices = reserveLeafChoices(groups).filter(({ id }) => id !== reserveLeafId);
  const active = commitment();
  const inactive = commitment(false);
  assert.deepEqual(
    presentStoredCommitmentLeaf(
      { id: reserveLeafId, name: 'Rent', groupName: 'Housing', active: false },
      choices
    ),
    { id: reserveLeafId, label: 'Housing / Rent', selectable: false }
  );
  assert.match(commitmentActivationError(active, choices) ?? '', /active reserve leaf/i);
  assert.equal(
    validateCommitmentForm(values(), choices, { status: 'edit', commitment: active }).valid,
    false
  );
  assert.equal(
    validateCommitmentForm(values(), choices, { status: 'edit', commitment: inactive }).valid,
    true
  );
  assert.equal(
    validateCommitmentForm(
      values({ categoryId: otherReserveLeafId }),
      choices,
      { status: 'edit', commitment: active }
    ).valid,
    true
  );
});
