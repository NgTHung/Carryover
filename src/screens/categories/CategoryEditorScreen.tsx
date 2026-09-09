import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { categoryNameSchema } from '../../data/category-validation';
import type { CategoryGroupWithLeaves } from '../../data/category-types';
import { Button, Input } from '../../ui';
import { CategoryGroupCard, KindPicker } from './CategoryGroupCard';
import type {
  CategoryEditorData,
  CategoryEditorDeleteState,
  CategoryEditorFormState,
} from './category-editor-contract';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; groups: CategoryGroupWithLeaves[] }
  | { status: 'error'; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function validateName(name: string): string | undefined {
  const parsed = categoryNameSchema.safeParse(name);
  return parsed.success ? undefined : 'Enter a category name';
}

function swapIds(ids: string[], index: number, offset: -1 | 1): string[] {
  const target = index + offset;
  if (target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function CategoryEditorScreen({ data }: { data: CategoryEditorData }) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [form, setForm] = useState<CategoryEditorFormState>({ status: 'closed' });
  const [deleteState, setDeleteState] = useState<CategoryEditorDeleteState>({ status: 'closed' });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | undefined>();

  const load = useCallback(async () => {
    try {
      const groups = await data.listActiveCategoryGroups();
      setLoadState({ status: 'ready', groups });
    } catch (error: unknown) {
      setLoadState({ status: 'error', message: errorMessage(error) });
    }
  }, [data]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = loadState.status === 'ready' ? loadState.groups : [];
  const suggestedCount = useMemo(
    () =>
      groups.reduce(
        (count, group) =>
          count + (group.isSuggestion ? 1 : 0) + group.leaves.filter((leaf) => leaf.isSuggestion).length,
        0
      ),
    [groups]
  );

  const runMutation = useCallback(
    async (action: () => Promise<void>, successMessage?: string) => {
      setBusy(true);
      setFeedback(undefined);
      try {
        await action();
        await load();
        setForm({ status: 'closed' });
        setDeleteState({ status: 'closed' });
        if (successMessage) setFeedback(successMessage);
      } catch (error: unknown) {
        setFeedback(errorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const submitGroup = useCallback(async () => {
    if (form.status !== 'group') return;
    const error = validateName(form.name);
    if (error) {
      setForm({ ...form, error });
      return;
    }
    await runMutation(
      () =>
        data.createCategory({
          level: 'group',
          name: form.name,
          kind: form.kind,
        }).then(() => undefined),
      'Group created'
    );
  }, [data, form, runMutation]);

  const submitLeaf = useCallback(async () => {
    if (form.status !== 'leaf') return;
    const error = validateName(form.name);
    if (error) {
      setForm({ ...form, error });
      return;
    }
    await runMutation(
      () =>
        data.createCategory({
          level: 'leaf',
          name: form.name,
          groupId: form.groupId,
        }).then(() => undefined),
      'Leaf created'
    );
  }, [data, form, runMutation]);

  const submitRename = useCallback(async (categoryId: string, name: string) => {
    const error = validateName(name);
    if (error) {
      setForm((current) =>
        current.status === 'rename' && current.categoryId === categoryId
          ? { ...current, error }
          : current
      );
      return;
    }
    await runMutation(
      () => data.renameCategory({ categoryId, name }),
      'Category renamed'
    );
  }, [data, runMutation]);

  const moveGroup = useCallback(
    (index: number, offset: -1 | 1) => {
      const nextIds = swapIds(groups.map((group) => group.id), index, offset);
      if (nextIds[index] === groups[index]?.id) return;
      void runMutation(() => data.reorderCategories({ level: 'group', categoryIds: nextIds }));
    },
    [data, groups, runMutation]
  );

  const moveLeaf = useCallback(
    (group: CategoryGroupWithLeaves, index: number, offset: -1 | 1) => {
      const nextIds = swapIds(group.leaves.map((leaf) => leaf.id), index, offset);
      if (nextIds[index] === group.leaves[index]?.id) return;
      void runMutation(() =>
        data.reorderCategories({ level: 'leaf', groupId: group.id, categoryIds: nextIds })
      );
    },
    [data, runMutation]
  );

  const beginDelete = useCallback(
    (categoryId: string, label: string, detail: string) =>
      setDeleteState({ status: 'open', categoryId, label, detail }),
    []
  );

  const confirmDelete = useCallback(() => {
    if (deleteState.status !== 'open') return;
    void runMutation(
      () => data.softDeleteCategory(deleteState.categoryId),
      `${deleteState.label} deleted`
    );
  }, [data, deleteState, runMutation]);

  if (loadState.status === 'loading') {
    return <Message title="Categories" detail="Loading categories…" />;
  }

  if (loadState.status === 'error') {
    return (
      <View className="flex-1 gap-4 bg-ground-light px-5 py-16 dark:bg-ground-dark">
        <Text className="text-title font-bold text-ink-light dark:text-ink-dark">Categories</Text>
        <Text className="text-body text-error-light dark:text-error-dark">{loadState.message}</Text>
        <Button onPress={() => void load()}>Try again</Button>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerClassName="gap-5 bg-ground-light px-5 pb-16 pt-16 dark:bg-ground-dark"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-1">
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">
          SETTINGS
        </Text>
        <Text className="text-title font-bold text-ink-light dark:text-ink-dark">Categories</Text>
        <Text className="text-body text-muted-light dark:text-muted-dark">
          Groups hold leaves. Transactions use leaves only.
        </Text>
      </View>

      {feedback ? (
        <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
          {feedback}
        </Text>
      ) : null}

      <View className="gap-3">
        {suggestedCount > 0 ? (
          <Button
            disabled={busy}
            variant="danger"
            fullWidth
            onPress={() =>
              void runMutation(
                () => data.deleteSuggestedCategories(),
                'Suggested categories deleted'
              )
            }
          >
            Delete suggested categories ({suggestedCount})
          </Button>
        ) : null}
        {form.status === 'group' ? (
          <View className="gap-3 rounded-surface border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark">
            <Input
              autoFocus
              label="Group name"
              value={form.name}
              error={form.error}
              onChangeText={(name) => setForm({ ...form, name, error: undefined })}
            />
            <KindPicker
              kind={form.kind}
              disabled={busy}
              onChange={(kind) => setForm({ ...form, kind })}
            />
            <View className="flex-row gap-2">
              <Button disabled={busy} onPress={() => void submitGroup()}>
                Save group
              </Button>
              <Button variant="secondary" disabled={busy} onPress={() => setForm({ status: 'closed' })}>
                Cancel
              </Button>
            </View>
          </View>
        ) : (
          <Button
            disabled={busy}
            fullWidth
            onPress={() => setForm({ status: 'group', name: '', kind: 'spend' })}
          >
            Add group
          </Button>
        )}
      </View>

      {groups.map((group, groupIndex) => (
        <CategoryGroupCard
          key={group.id}
          group={group}
          groupIndex={groupIndex}
          groupCount={groups.length}
          form={form}
          deleteState={deleteState}
          busy={busy}
          onFormChange={setForm}
          onRename={(categoryId, name) => void submitRename(categoryId, name)}
          onGroupKindChange={(kind) =>
            void runMutation(() => data.setCategoryGroupKind({ groupId: group.id, kind }))
          }
          onMoveGroup={(offset) => moveGroup(groupIndex, offset)}
          onMoveLeaf={(index, offset) => moveLeaf(group, index, offset)}
          onBeginRename={(categoryId, name) => setForm({ status: 'rename', categoryId, name })}
          onBeginLeaf={() => setForm({ status: 'leaf', groupId: group.id, name: '' })}
          onSaveLeaf={() => void submitLeaf()}
          onBeginDelete={beginDelete}
          onConfirmDelete={confirmDelete}
          onCancelDelete={() => setDeleteState({ status: 'closed' })}
        />
      ))}
    </ScrollView>
  );
}

function Message({ title, detail }: { title: string; detail: string }) {
  return (
    <View className="flex-1 gap-2 bg-ground-light px-5 py-16 dark:bg-ground-dark">
      <Text className="text-title font-bold text-ink-light dark:text-ink-dark">{title}</Text>
      <Text className="text-body text-muted-light dark:text-muted-dark">{detail}</Text>
    </View>
  );
}
