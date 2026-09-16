import { strict as assert } from 'node:assert';

import type { CategoryGroupWithLeaves } from '../src/data/category-types';
import {
  filterLeafChoices,
  findLeafChoice,
  normalizeLeafSearch,
} from '../src/ui/categories/leaf-search';

function group(
  id: string,
  name: string,
  leaves: Array<[string, string]>
): CategoryGroupWithLeaves {
  const value: CategoryGroupWithLeaves = {
    level: 'group',
    id,
    name,
    sort: Number(id),
    kind: 'spend',
    isSuggestion: false,
    deletedAt: null,
    leaves: [],
  };
  value.leaves = leaves.map(([leafId, leafName], sort) => ({
    level: 'leaf',
    id: leafId,
    name: leafName,
    sort,
    kind: value.kind,
    isSuggestion: false,
    deletedAt: null,
    group: {
      level: 'group',
      id: value.id,
      name: value.name,
      sort: value.sort,
      kind: value.kind,
    },
  }));
  return value;
}

const groups = [
  group('1', 'Đồ ăn', [['1a', 'Cà phê'], ['1b', 'Bánh mì']]),
  group('2', 'Travel', [['2a', 'Cà phê'], ['2b', 'Flights']]),
  group('3', 'Empty', []),
];

test('normalizes case, accents, whitespace, and Vietnamese đ', () => {
  assert.equal(normalizeLeafSearch('  ĐỒ ĂN  '), 'do an');
  assert.equal(normalizeLeafSearch('CÀ PHÊ'), 'ca phe');
});

test('matches leaf names and preserves stored group and leaf order', () => {
  const results = filterLeafChoices(groups, 'ca phe');
  assert.deepEqual(
    results.map(({ group: resultGroup, leaves }) => [
      resultGroup.id,
      leaves.map((leaf) => leaf.id),
    ]),
    [
      ['1', ['1a']],
      ['2', ['2a']],
    ]
  );
});

test('a group match exposes all of its leaves', () => {
  const results = filterLeafChoices(groups, 'do an');
  assert.deepEqual(results.map(({ leaves }) => leaves.map((leaf) => leaf.id)), [['1a', '1b']]);
});

test('an empty query restores every active group, including empty groups', () => {
  const results = filterLeafChoices(groups, '   ');
  assert.deepEqual(results.map(({ group: resultGroup }) => resultGroup.id), ['1', '2', '3']);
  assert.deepEqual(results[0]?.leaves.map((leaf) => leaf.id), ['1a', '1b']);
});

test('filtered results do not change the selected leaf identity', () => {
  const selected = findLeafChoice(groups, '2a');
  assert.equal(selected?.name, 'Cà phê');
  assert.equal(findLeafChoice(groups, 'missing'), undefined);
});
