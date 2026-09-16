/**
 * Creates one category inside the transaction editor.
 *
 * Creation commits through the shared category API. The returned identity is
 * handed to the editor before a separate category-list refresh, so a failed
 * read can be retried without creating a duplicate category.
 */
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import type {
  Category,
  CategoryGroupWithLeaves,
  CategoryKind,
} from '../../data/category-types';
import {
  categoryNameSchema,
  createCategoryInputSchema,
  type CreateCategoryInput,
} from '../../data/category-validation';
import { Button, Input } from '../index';
import { KindPicker } from './CategoryGroupCard';

export type InlineCategoryCreationIntent =
  | { kind: 'group' }
  | { kind: 'leaf'; groupId?: string };

type InlineCategoryForm =
  | { kind: 'group'; name: string; categoryKind: CategoryKind; error?: string }
  | { kind: 'leaf'; name: string; groupId: string | null; error?: string };

type InlineCategoryMutation =
  | { status: 'idle' }
  | { status: 'creating' }
  | { status: 'failed'; message: string }
  | { status: 'refreshing'; category: Category }
  | { status: 'refresh-failed'; category: Category; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function nameError(name: string): string | undefined {
  return categoryNameSchema.safeParse(name).success
    ? undefined
    : 'Enter a category name';
}

function initialForm(intent: InlineCategoryCreationIntent): InlineCategoryForm {
  return intent.kind === 'group'
    ? { kind: 'group', name: '', categoryKind: 'spend' }
    : { kind: 'leaf', name: '', groupId: intent.groupId ?? null };
}

function refreshErrorText(mutation: InlineCategoryMutation): string | undefined {
  return mutation.status === 'refresh-failed' ? mutation.message : undefined;
}

export function InlineCategoryCreator({
  groups,
  intent,
  createCategory,
  refreshCategories,
  onCreated,
  onCancel,
  onPendingChange,
}: {
  groups: CategoryGroupWithLeaves[];
  intent: InlineCategoryCreationIntent;
  createCategory: (input: CreateCategoryInput) => Promise<Category>;
  refreshCategories: () => Promise<void>;
  onCreated: (category: Category) => void;
  onCancel: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [form, setForm] = useState<InlineCategoryForm>(() => initialForm(intent));
  const [mutation, setMutation] = useState<InlineCategoryMutation>({ status: 'idle' });
  const createLockedRef = useRef(false);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      onPendingChange(false);
    };
  }, [onPendingChange]);

  const pending = mutation.status === 'creating' || mutation.status === 'refreshing';
  useEffect(() => {
    onPendingChange(pending);
  }, [onPendingChange, pending]);

  const refreshAfterCreate = async (category: Category) => {
    if (!activeRef.current) return;
    setMutation({ status: 'refreshing', category });
    try {
      await refreshCategories();
      if (!activeRef.current) return;
      setMutation({ status: 'idle' });
      if (category.level === 'leaf') onCancel();
    } catch (error: unknown) {
      if (!activeRef.current) return;
      setMutation({
        status: 'refresh-failed',
        category,
        message: errorMessage(error),
      });
    }
  };

  const submit = async () => {
    if (createLockedRef.current || pending) return;
    const error = nameError(form.name);
    if (error !== undefined) {
      setForm({ ...form, error });
      return;
    }
    if (form.kind === 'leaf' && form.groupId === null) {
      setForm({ ...form, error: 'Select a group.' });
      return;
    }

    const input = form.kind === 'group'
      ? createCategoryInputSchema.safeParse({
          level: 'group',
          name: form.name,
          kind: form.categoryKind,
        })
      : createCategoryInputSchema.safeParse({
          level: 'leaf',
          name: form.name,
          groupId: form.groupId,
        });
    if (!input.success) {
      setForm({ ...form, error: 'Enter a valid category.' });
      return;
    }

    createLockedRef.current = true;
    setMutation({ status: 'creating' });
    try {
      const category = await createCategory(input.data);
      onCreated(category);
      createLockedRef.current = false;
      if (category.level === 'group') {
        setForm({ kind: 'leaf', name: '', groupId: category.id });
      }
      await refreshAfterCreate(category);
    } catch (error: unknown) {
      if (!activeRef.current) return;
      createLockedRef.current = false;
      setMutation({ status: 'failed', message: errorMessage(error) });
    }
  };

  const retryRefresh = async () => {
    if (mutation.status !== 'refresh-failed' || !activeRef.current) return;
    await refreshAfterCreate(mutation.category);
  };

  const cancel = () => {
    if (pending) return;
    onCancel();
  };

  const failure = mutation.status === 'failed' ? mutation.message : refreshErrorText(mutation);
  const refreshFailed = mutation.status === 'refresh-failed';
  const leafCreationFinished =
    mutation.status === 'refresh-failed' && mutation.category.level === 'leaf';

  return (
    <View
      testID="inline-category-creator"
      className="gap-3 rounded-surface border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark"
    >
      <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">
        {form.kind === 'group' ? 'New group' : 'New leaf'}
      </Text>
      {failure ? (
        <Text accessibilityRole="alert" className="text-detail text-error-light dark:text-error-dark">
          {failure}
        </Text>
      ) : null}
      {form.kind === 'group' ? (
        <View className="gap-3">
          <Input
            autoFocus
            label="Group name"
            value={form.name}
            error={form.error}
            editable={!pending}
            onChangeText={(name) => setForm({ ...form, name, error: undefined })}
          />
          <KindPicker
            kind={form.categoryKind}
            disabled={pending}
            onChange={(categoryKind) => setForm({ ...form, categoryKind })}
          />
        </View>
      ) : (
        <View className="gap-3">
          <Input
            autoFocus
            label="Leaf name"
            value={form.name}
            error={form.error}
            editable={!pending}
            onChangeText={(name) => setForm({ ...form, name, error: undefined })}
          />
          <View className="gap-2">
            <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">Leaf group</Text>
            <View className="flex-row flex-wrap gap-2">
              {groups.map((group) => (
                <Button
                  key={group.id}
                  size="compact"
                  variant={form.groupId === group.id ? 'primary' : 'secondary'}
                  accessibilityState={{ selected: form.groupId === group.id }}
                  disabled={pending}
                  onPress={() => setForm({ ...form, groupId: group.id, error: undefined })}
                >
                  {group.name}
                </Button>
              ))}
            </View>
            {groups.length === 0 ? (
              <Text className="text-detail text-muted-light dark:text-muted-dark">
                Create a group before creating a leaf.
              </Text>
            ) : null}
          </View>
        </View>
      )}
      {refreshFailed ? (
        <Button
          size="compact"
          variant="secondary"
          disabled={pending}
          onPress={() => void retryRefresh()}
        >
          Retry category refresh
        </Button>
      ) : null}
      {leafCreationFinished ? (
        <Text className="text-detail text-muted-light dark:text-muted-dark">
          Category created. The transaction leaf is selected.
        </Text>
      ) : (
        <View className="flex-row gap-2">
          <Button disabled={pending} onPress={() => void submit()}>
            {form.kind === 'group' ? 'Create group' : 'Create leaf'}
          </Button>
          <Button variant="secondary" disabled={pending} onPress={cancel}>
            Cancel
          </Button>
        </View>
      )}
    </View>
  );
}
