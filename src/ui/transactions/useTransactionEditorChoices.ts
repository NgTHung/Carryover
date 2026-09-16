/**
 * Owns category choices that can change while a transaction form stays open.
 *
 * A returned category is merged immediately so the user can continue without
 * waiting for the read. A later refresh replaces the list with authoritative
 * data while retaining returned categories if the read is briefly stale.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  Category,
  CategoryGroupWithLeaves,
  CategoryLeaf,
} from '../../data/category-types';

function groupFromLeaf(leaf: CategoryLeaf): CategoryGroupWithLeaves {
  return {
    level: 'group',
    id: leaf.group.id,
    name: leaf.group.name,
    sort: leaf.group.sort,
    kind: leaf.group.kind,
    isSuggestion: false,
    deletedAt: null,
    leaves: [leaf],
  };
}

function mergeCategory(
  groups: readonly CategoryGroupWithLeaves[],
  category: Category
): CategoryGroupWithLeaves[] {
  if (category.level === 'group') {
    const index = groups.findIndex((group) => group.id === category.id);
    if (index === -1) return [...groups, { ...category, leaves: [] }];
    return groups.map((group, groupIndex) =>
      groupIndex === index ? { ...category, leaves: group.leaves } : group
    );
  }

  const groupIndex = groups.findIndex((group) => group.id === category.group.id);
  if (groupIndex === -1) return [...groups, groupFromLeaf(category)];

  return groups.map((group, index) => {
    if (index !== groupIndex) return group;
    const leafIndex = group.leaves.findIndex((leaf) => leaf.id === category.id);
    if (leafIndex === -1) return { ...group, leaves: [...group.leaves, category] };
    return {
      ...group,
      leaves: group.leaves.map((leaf, leafIndexValue) =>
        leafIndexValue === leafIndex ? category : leaf
      ),
    };
  });
}

export type TransactionEditorChoices = {
  groups: CategoryGroupWithLeaves[];
  categoryRefreshError?: string;
  mergeCreatedCategory: (category: Category) => void;
  refreshCategories: () => Promise<void>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useTransactionEditorChoices(
  initialGroups: CategoryGroupWithLeaves[],
  listActiveCategoryGroups: () => Promise<CategoryGroupWithLeaves[]>
): TransactionEditorChoices {
  const [groups, setGroups] = useState<CategoryGroupWithLeaves[]>(initialGroups);
  const [categoryRefreshError, setCategoryRefreshError] = useState<string>();
  const returnedCategoriesRef = useRef<Category[]>([]);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    returnedCategoriesRef.current = [];
    setGroups(initialGroups);
    setCategoryRefreshError(undefined);
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
    };
  }, [initialGroups]);

  const mergeCreatedCategory = useCallback((category: Category) => {
    returnedCategoriesRef.current = [
      ...returnedCategoriesRef.current.filter((candidate) => candidate.id !== category.id),
      category,
    ];
    setGroups((current) => mergeCategory(current, category));
    setCategoryRefreshError(undefined);
  }, []);

  const refreshCategories = useCallback(async () => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    try {
      const loaded = await listActiveCategoryGroups();
      if (!mountedRef.current || generation !== generationRef.current) return;
      const merged = returnedCategoriesRef.current.reduce(
        (current, category) => mergeCategory(current, category),
        loaded
      );
      setGroups(merged);
      setCategoryRefreshError(undefined);
    } catch (error: unknown) {
      if (mountedRef.current && generation === generationRef.current) {
        setCategoryRefreshError(errorMessage(error));
      }
      throw error;
    }
  }, [listActiveCategoryGroups]);

  return {
    groups,
    categoryRefreshError,
    mergeCreatedCategory,
    refreshCategories,
  };
}

export function mergeCreatedCategoryChoices(
  groups: readonly CategoryGroupWithLeaves[],
  category: Category
): CategoryGroupWithLeaves[] {
  return mergeCategory(groups, category);
}
