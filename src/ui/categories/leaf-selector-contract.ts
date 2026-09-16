/**
 * Shared contract for choosing a transaction leaf.
 *
 * Selection stays independent from persistence so the manual creator can use
 * the same search surface without importing category mutations. The editor
 * opts into creation through the second capability variant.
 */
import type { CategoryGroupWithLeaves } from '../../data/category-types';

export type LeafSelectorCapability =
  | { kind: 'selection-only' }
  | {
      kind: 'creation-enabled';
      onCreateGroup: () => void;
      onCreateLeaf: (groupId?: string) => void;
    };

export type LeafSelectorProps = {
  groups: CategoryGroupWithLeaves[];
  selectedLeafId: string | null;
  disabled: boolean;
  onSelect: (leafId: string) => void;
  capability?: LeafSelectorCapability;
};
