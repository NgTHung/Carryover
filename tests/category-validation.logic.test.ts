import { strict as assert } from 'node:assert';

import {
  categoryIdSchema,
  createCategoryInputSchema,
} from '../src/data/category-validation';
import type {
  Category,
  CategoryGroup,
  CategoryGroupReference,
  CategoryLeaf,
} from '../src/data/category-types';

const groupId = '11111111-1111-4111-8111-111111111111';
const leafId = '22222222-2222-4222-8222-222222222222';

const group: CategoryGroup = {
  level: 'group',
  id: groupId,
  name: 'Food',
  sort: 0,
  kind: 'spend',
  isSuggestion: false,
  deletedAt: null,
};

const leaf: CategoryLeaf = {
  level: 'leaf',
  id: leafId,
  name: 'Groceries',
  sort: 0,
  kind: 'spend',
  isSuggestion: false,
  deletedAt: null,
  group: group,
};

function groupReference(category: Category): CategoryGroupReference | undefined {
  return category.level === 'leaf' ? category.group : undefined;
}

test('category input schema distinguishes groups from leaves', () => {
  assert.deepEqual(
    createCategoryInputSchema.parse({
      level: 'group',
      name: ' Food ',
      sort: 0,
      kind: 'spend',
    }),
    { level: 'group', name: 'Food', sort: 0, kind: 'spend' }
  );
  assert.deepEqual(
    createCategoryInputSchema.parse({
      level: 'leaf',
      name: ' Groceries ',
      sort: 1,
      groupId,
    }),
    { level: 'leaf', name: 'Groceries', sort: 1, groupId }
  );
});

test('category input rejects malformed levels and relationships', () => {
  assert.throws(() =>
    createCategoryInputSchema.parse({
      level: 'group',
      name: 'Food',
      sort: 0,
      kind: 'spend',
      groupId,
    })
  );
  assert.throws(() =>
    createCategoryInputSchema.parse({
      level: 'leaf',
      name: 'Groceries',
      sort: 0,
    })
  );
  assert.throws(() =>
    createCategoryInputSchema.parse({
      level: 'branch',
      name: 'Too deep',
      sort: 0,
      groupId,
    })
  );
  assert.throws(() =>
    createCategoryInputSchema.parse({
      level: 'leaf',
      name: 'Groceries',
      sort: 0,
      groupId: 'not-a-uuid',
    })
  );
});

test('category input rejects empty names and non-integer sort values', () => {
  assert.throws(() =>
    createCategoryInputSchema.parse({
      level: 'group',
      name: '   ',
      sort: 0,
      kind: 'spend',
    })
  );
  assert.throws(() =>
    createCategoryInputSchema.parse({
      level: 'group',
      name: 'Food',
      sort: 1.5,
      kind: 'spend',
    })
  );
  assert.throws(() =>
    createCategoryInputSchema.parse({
      level: 'group',
      name: 'Food',
      sort: -1,
      kind: 'spend',
    })
  );
});

test('category domain types expose a group reference only on leaves', () => {
  assert.equal(groupReference(group), undefined);
  assert.deepEqual(groupReference(leaf), group);

  const reference: CategoryGroupReference = group;
  assert.equal(reference.level, 'group');

  // @ts-expect-error A leaf cannot be used as a leaf's group reference.
  const invalidLeaf: CategoryLeaf = { ...leaf, group: leaf };
  void invalidLeaf;
});

test('category IDs require UUIDs', () => {
  assert.equal(categoryIdSchema.parse(groupId), groupId);
  assert.throws(() => categoryIdSchema.parse('group-id'));
});
