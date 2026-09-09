import { Text, View } from 'react-native';

import type { CategoryGroupWithLeaves, CategoryKind } from '../../data/category-types';
import { Button, Input } from '..';
import type {
  CategoryEditorDeleteState,
  CategoryEditorFormState,
} from './category-editor-contract';

type CategoryGroupCardProps = {
  group: CategoryGroupWithLeaves;
  groupIndex: number;
  groupCount: number;
  form: CategoryEditorFormState;
  deleteState: CategoryEditorDeleteState;
  busy: boolean;
  onFormChange: (form: CategoryEditorFormState) => void;
  onRename: (categoryId: string, name: string) => void;
  onGroupKindChange: (kind: CategoryKind) => void;
  onMoveGroup: (offset: -1 | 1) => void;
  onMoveLeaf: (index: number, offset: -1 | 1) => void;
  onBeginRename: (categoryId: string, name: string) => void;
  onBeginLeaf: () => void;
  onSaveLeaf: () => void;
  onBeginDelete: (categoryId: string, label: string, detail: string) => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

export function CategoryGroupCard({
  group,
  groupIndex,
  groupCount,
  form,
  deleteState,
  busy,
  onFormChange,
  onRename,
  onGroupKindChange,
  onMoveGroup,
  onMoveLeaf,
  onBeginRename,
  onBeginLeaf,
  onSaveLeaf,
  onBeginDelete,
  onConfirmDelete,
  onCancelDelete,
}: CategoryGroupCardProps) {
  const isDeletingGroup =
    deleteState.status === 'open' && deleteState.categoryId === group.id;
  const isDeletingLeaf =
    deleteState.status === 'open' &&
    group.leaves.some((leaf) => leaf.id === deleteState.categoryId);

  return (
    <View className="gap-3 rounded-surface border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark">
      {form.status === 'rename' && form.categoryId === group.id ? (
        <RenameForm form={form} busy={busy} onChange={onFormChange} onSave={onRename} />
      ) : (
        <View className="gap-3">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-1">
              <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">
                {group.name}
              </Text>
              <Text className="text-detail text-muted-light dark:text-muted-dark">
                {group.kind === 'reserve' ? 'Reserve' : 'Spend'} group
              </Text>
            </View>
            <Button
              disabled={busy}
              size="compact"
              variant="secondary"
              accessibilityLabel={`Rename ${group.name}`}
              onPress={() => onBeginRename(group.id, group.name)}
            >
              Rename
            </Button>
          </View>
          <KindPicker kind={group.kind} disabled={busy} onChange={onGroupKindChange} />
          <View className="flex-row gap-2">
            <Button
              disabled={busy || groupIndex === 0}
              size="compact"
              variant="secondary"
              accessibilityLabel={`Move ${group.name} up`}
              onPress={() => onMoveGroup(-1)}
            >
              Up
            </Button>
            <Button
              disabled={busy || groupIndex === groupCount - 1}
              size="compact"
              variant="secondary"
              accessibilityLabel={`Move ${group.name} down`}
              onPress={() => onMoveGroup(1)}
            >
              Down
            </Button>
            <Button
              disabled={busy}
              size="compact"
              variant="danger"
              accessibilityLabel={`Delete ${group.name}`}
              onPress={() =>
                onBeginDelete(
                  group.id,
                  group.name,
                  `Delete ${group.name} and its ${group.leaves.length} leaves?`
                )
              }
            >
              Delete
            </Button>
          </View>
        </View>
      )}

      <View className="gap-2 border-l-2 border-faint-light pl-3 dark:border-faint-dark">
        {group.leaves.map((leaf, leafIndex) => (
          <View key={leaf.id} className="gap-2 border-b border-faint-light pb-2 dark:border-faint-dark">
            {form.status === 'rename' && form.categoryId === leaf.id ? (
              <RenameForm form={form} busy={busy} onChange={onFormChange} onSave={onRename} />
            ) : (
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-body text-ink-light dark:text-ink-dark">{leaf.name}</Text>
                <Button
                  disabled={busy}
                  size="compact"
                  variant="secondary"
                  accessibilityLabel={`Rename ${leaf.name}`}
                  onPress={() => onBeginRename(leaf.id, leaf.name)}
                >
                  Rename
                </Button>
              </View>
            )}
            <View className="flex-row gap-2">
              <Button
                disabled={busy || leafIndex === 0}
                size="compact"
                variant="secondary"
                accessibilityLabel={`Move ${leaf.name} up`}
                onPress={() => onMoveLeaf(leafIndex, -1)}
              >
                Up
              </Button>
              <Button
                disabled={busy || leafIndex === group.leaves.length - 1}
                size="compact"
                variant="secondary"
                accessibilityLabel={`Move ${leaf.name} down`}
                onPress={() => onMoveLeaf(leafIndex, 1)}
              >
                Down
              </Button>
              <Button
                disabled={busy}
                size="compact"
                variant="danger"
                accessibilityLabel={`Delete ${leaf.name}`}
                onPress={() => onBeginDelete(leaf.id, leaf.name, `Delete ${leaf.name}?`)}
              >
                Delete
              </Button>
            </View>
          </View>
        ))}
        {form.status === 'leaf' && form.groupId === group.id ? (
          <View className="gap-3 pt-2">
            <Input
              autoFocus
              label="Leaf name"
              value={form.name}
              error={form.error}
              onChangeText={(name) => onFormChange({ ...form, name, error: undefined })}
            />
            <View className="flex-row gap-2">
              <Button disabled={busy} onPress={onSaveLeaf}>
                Save leaf
              </Button>
              <Button variant="secondary" disabled={busy} onPress={() => onFormChange({ status: 'closed' })}>
                Cancel
              </Button>
            </View>
          </View>
        ) : (
          <Button
            disabled={busy || form.status !== 'closed'}
            size="compact"
            variant="secondary"
            onPress={onBeginLeaf}
          >
            Add leaf to {group.name}
          </Button>
        )}
      </View>

      {isDeletingGroup || isDeletingLeaf ? (
        <View className="gap-2 border-t border-error-light pt-3 dark:border-error-dark">
          <Text className="text-detail text-error-light dark:text-error-dark">
            {deleteState.status === 'open' ? deleteState.detail : ''}
          </Text>
          <View className="flex-row gap-2">
            <Button disabled={busy} size="compact" variant="danger" onPress={onConfirmDelete}>
              Confirm delete
            </Button>
            <Button variant="secondary" disabled={busy} size="compact" onPress={onCancelDelete}>
              Cancel
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function KindPicker({
  kind,
  disabled,
  onChange,
}: {
  kind: CategoryKind;
  disabled: boolean;
  onChange: (kind: CategoryKind) => void;
}) {
  return (
    <View className="gap-1">
      <Text className="text-detail font-semibold text-muted-light dark:text-muted-dark">Group kind</Text>
      <View className="flex-row gap-2">
        {(['spend', 'reserve'] as const).map((option) => (
          <Button
            key={option}
            disabled={disabled}
            size="compact"
            variant={kind === option ? 'primary' : 'secondary'}
            accessibilityState={{ selected: kind === option }}
            onPress={() => onChange(option)}
          >
            {option === 'spend' ? 'Spend' : 'Reserve'}
          </Button>
        ))}
      </View>
    </View>
  );
}

function RenameForm({
  form,
  busy,
  onChange,
  onSave,
}: {
  form: Extract<CategoryEditorFormState, { status: 'rename' }>;
  busy: boolean;
  onChange: (form: CategoryEditorFormState) => void;
  onSave: (categoryId: string, name: string) => void;
}) {
  return (
    <View className="gap-3">
      <Input
        autoFocus
        label="Category name"
        value={form.name}
        error={form.error}
        onChangeText={(name) => onChange({ ...form, name, error: undefined })}
      />
      <View className="flex-row gap-2">
        <Button disabled={busy} onPress={() => onSave(form.categoryId, form.name)}>
          Save name
        </Button>
        <Button variant="secondary" disabled={busy} onPress={() => onChange({ status: 'closed' })}>
          Cancel
        </Button>
      </View>
    </View>
  );
}
