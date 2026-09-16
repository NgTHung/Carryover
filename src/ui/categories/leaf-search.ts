/**
 * Provides deterministic local filtering for active category leaves.
 *
 * Search ignores case and Unicode accents, including Vietnamese đ. The input
 * groups and leaves are never reordered, which keeps category choices stable
 * while you type and makes the selected identity independent of the query.
 */
import type {
  CategoryGroupWithLeaves,
  CategoryLeaf,
} from '../../data/category-types';

export type LeafSearchResult = {
  group: CategoryGroupWithLeaves;
  leaves: CategoryLeaf[];
};

export function normalizeLeafSearch(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/đ/g, 'd');
}

export function filterLeafChoices(
  groups: readonly CategoryGroupWithLeaves[],
  query: string
): LeafSearchResult[] {
  const normalizedQuery = normalizeLeafSearch(query);
  if (normalizedQuery === '') {
    return groups.map((group) => ({ group, leaves: [...group.leaves] }));
  }

  return groups.flatMap((group) => {
    const groupMatches = normalizeLeafSearch(group.name).includes(normalizedQuery);
    const leaves = groupMatches
      ? [...group.leaves]
      : group.leaves.filter((leaf) =>
          normalizeLeafSearch(leaf.name).includes(normalizedQuery)
        );
    return leaves.length === 0 ? [] : [{ group, leaves }];
  });
}

export function findLeafChoice(
  groups: readonly CategoryGroupWithLeaves[],
  leafId: string | null
): CategoryLeaf | undefined {
  if (leafId === null) return undefined;
  for (const group of groups) {
    const leaf = group.leaves.find((candidate) => candidate.id === leafId);
    if (leaf !== undefined) return leaf;
  }
  return undefined;
}
