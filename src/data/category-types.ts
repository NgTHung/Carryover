/**
 * Domain values for the two-level category taxonomy.
 *
 * A leaf carries a group reference rather than another arbitrary category, so
 * the in-memory model cannot describe a third level.
 */
export type CategoryKind = 'spend' | 'reserve';

export type CategoryGroupReference = {
  level: 'group';
  id: string;
  name: string;
  sort: number;
  kind: CategoryKind;
};

type CategoryFields = {
  id: string;
  name: string;
  sort: number;
  kind: CategoryKind;
  isSuggestion: boolean;
  deletedAt: Date | null;
};

export type CategoryGroup = CategoryFields & {
  level: 'group';
};

export type CategoryLeaf = CategoryFields & {
  level: 'leaf';
  group: CategoryGroupReference;
};

export type Category = CategoryGroup | CategoryLeaf;
