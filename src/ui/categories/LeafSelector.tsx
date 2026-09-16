/**
 * Lets you find and choose one active leaf without changing the ledger.
 *
 * Group headings provide context for duplicate leaf names. The selected leaf
 * remains visible while a query filters it out, so typing never changes the
 * transaction by itself.
 */
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Input } from '../index';
import { filterLeafChoices, findLeafChoice } from './leaf-search';
import type {
  LeafSelectorCapability,
  LeafSelectorProps,
} from './leaf-selector-contract';

function SelectedLeaf({
  groups,
  selectedLeafId,
}: Pick<LeafSelectorProps, 'groups' | 'selectedLeafId'>) {
  if (selectedLeafId === null) return null;
  const selectedLeaf = findLeafChoice(groups, selectedLeafId);
  if (selectedLeaf === undefined) {
    return (
      <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
        Selected leaf is unavailable. Choose another leaf.
      </Text>
    );
  }
  return (
    <View className="gap-1 rounded-surface border border-need-light bg-surface-light p-3 dark:border-need-dark dark:bg-surface-dark">
      <Text className="text-detail text-muted-light dark:text-muted-dark">Selected leaf</Text>
      <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">
        {selectedLeaf.name} · {selectedLeaf.group.name}
      </Text>
    </View>
  );
}

function CreationActions({
  capability,
  disabled,
}: {
  capability: LeafSelectorCapability;
  disabled: boolean;
}) {
  if (capability.kind !== 'creation-enabled') return null;
  return (
    <View className="gap-2 border-t border-faint-light pt-3 dark:border-faint-dark">
      <Text className="text-detail text-muted-light dark:text-muted-dark">
        Cannot find the right leaf?
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Button
          size="compact"
          variant="secondary"
          disabled={disabled}
          onPress={capability.onCreateGroup}
        >
          New group
        </Button>
        <Button
          size="compact"
          variant="secondary"
          disabled={disabled}
          onPress={() => capability.onCreateLeaf()}
        >
          New leaf
        </Button>
      </View>
    </View>
  );
}

export function LeafSelector({
  groups,
  selectedLeafId,
  disabled,
  onSelect,
  capability = { kind: 'selection-only' },
  queryResetKey,
}: LeafSelectorProps) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => filterLeafChoices(groups, query), [groups, query]);

  useEffect(() => {
    if (queryResetKey !== undefined) setQuery('');
  }, [queryResetKey]);

  return (
    <View className="gap-3">
      <Input
        label="Search leaves"
        value={query}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setQuery}
      />
      <SelectedLeaf groups={groups} selectedLeafId={selectedLeafId} />
      {results.length === 0 ? (
        <Text className="text-body text-muted-light dark:text-muted-dark">
          No matching leaves.
        </Text>
      ) : (
        results.map(({ group, leaves }) => (
          <View key={group.id} className="gap-2">
            <Text className="text-detail font-semibold text-muted-light dark:text-muted-dark">
              {group.name}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {leaves.map((leaf) => (
                <Button
                  key={leaf.id}
                  size="compact"
                  variant={selectedLeafId === leaf.id ? 'primary' : 'secondary'}
                  accessibilityState={{ selected: selectedLeafId === leaf.id }}
                  accessibilityHint={`Group: ${group.name}`}
                  disabled={disabled}
                  onPress={() => onSelect(leaf.id)}
                >
                  {leaf.name}
                </Button>
              ))}
            </View>
          </View>
        ))
      )}
      <CreationActions capability={capability} disabled={disabled} />
    </View>
  );
}
