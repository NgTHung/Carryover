import { act, cleanup, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import type {
  Category,
  CategoryGroupWithLeaves,
} from '../src/data/category-types';
import { InlineCategoryCreator } from '../src/ui/categories/InlineCategoryCreator';

const foodId = '10000000-0000-4000-8000-000000000001';
const createdGroupId = '10000000-0000-4000-8000-000000000002';
const createdLeafId = '20000000-0000-4000-8000-000000000002';
const foodLeafId = '20000000-0000-4000-8000-000000000001';

function groups(): CategoryGroupWithLeaves[] {
  const food: CategoryGroupWithLeaves = {
    level: 'group',
    id: foodId,
    name: 'Food',
    sort: 0,
    kind: 'spend',
    isSuggestion: false,
    deletedAt: null,
    leaves: [],
  };
  food.leaves = [{
    level: 'leaf',
    id: foodLeafId,
    name: 'Groceries',
    sort: 0,
    kind: food.kind,
    isSuggestion: false,
    deletedAt: null,
    group: {
      level: 'group',
      id: food.id,
      name: food.name,
      sort: food.sort,
      kind: food.kind,
    },
  }];
  return [food];
}

function createdGroup(): Category {
  return {
    level: 'group',
    id: createdGroupId,
    name: 'Weekend',
    sort: 1,
    kind: 'reserve',
    isSuggestion: false,
    deletedAt: null,
  };
}

function createdLeaf(): Category {
  return {
    level: 'leaf',
    id: createdLeafId,
    name: 'Market',
    sort: 0,
    kind: 'reserve',
    isSuggestion: false,
    deletedAt: null,
    group: {
      level: 'group',
      id: createdGroupId,
      name: 'Weekend',
      sort: 1,
      kind: 'reserve',
    },
  };
}

function renderCreator(
  overrides: Partial<React.ComponentProps<typeof InlineCategoryCreator>> = {}
) {
  return render(
    <InlineCategoryCreator
      groups={groups()}
      intent={{ kind: 'group' }}
      createCategory={jest.fn(async () => createdGroup())}
      refreshCategories={jest.fn(async () => undefined)}
      onCreated={jest.fn()}
      onCancel={jest.fn()}
      onPendingChange={jest.fn()}
      {...overrides}
    />
  );
}

afterEach(cleanup);

test('validates names before writing and locks duplicate create taps', async () => {
  let resolveCreate: (category: Category) => void = () => undefined;
  const createCategory = jest.fn(
    () => new Promise<Category>((resolve) => { resolveCreate = resolve; })
  );
  const user = userEvent.setup();
  await renderCreator({ createCategory });

  await user.press(screen.getByRole('button', { name: 'Create group' }));
  expect(screen.getByText('Enter a category name')).toBeTruthy();
  expect(createCategory).not.toHaveBeenCalled();

  await user.type(screen.getByLabelText('Group name'), 'Weekend');
  const create = screen.getByRole('button', { name: 'Create group' });
  await fireEvent.press(create);
  await fireEvent.press(create);
  expect(createCategory).toHaveBeenCalledTimes(1);

  await act(async () => {
    resolveCreate(createdGroup());
  });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create leaf' })).toBeTruthy());
});

test('creates a group, opens its leaf form, and inherits the group kind', async () => {
  const createCategory = jest
    .fn<Promise<Category>, [{ level: 'group'; name: string; kind: 'spend' | 'reserve' } | { level: 'leaf'; name: string; groupId: string }]>()
    .mockResolvedValueOnce(createdGroup())
    .mockResolvedValueOnce(createdLeaf());
  const refreshCategories = jest.fn(async () => undefined);
  const onCreated = jest.fn();
  const onCancel = jest.fn();
  const user = userEvent.setup();
  await renderCreator({ createCategory, refreshCategories, onCreated, onCancel });

  await user.press(screen.getByRole('button', { name: 'Reserve' }));
  await user.type(screen.getByLabelText('Group name'), 'Weekend');
  await user.press(screen.getByRole('button', { name: 'Create group' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create leaf' })).toBeTruthy());

  expect(createCategory).toHaveBeenNthCalledWith(1, {
    level: 'group',
    name: 'Weekend',
    kind: 'reserve',
  });
  expect(refreshCategories).toHaveBeenCalledTimes(1);
  expect(onCreated).toHaveBeenNthCalledWith(1, createdGroup());

  await user.type(screen.getByLabelText('Leaf name'), 'Market');
  await user.press(screen.getByRole('button', { name: 'Create leaf' }));

  await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
  expect(createCategory).toHaveBeenNthCalledWith(2, {
    level: 'leaf',
    name: 'Market',
    groupId: createdGroupId,
  });
  expect(onCreated).toHaveBeenNthCalledWith(2, createdLeaf());
  expect(refreshCategories).toHaveBeenCalledTimes(2);
});

test('cancels without writing', async () => {
  const createCategory = jest.fn();
  const onCancel = jest.fn();
  const user = userEvent.setup();
  await renderCreator({ createCategory, onCancel });

  await user.press(screen.getByRole('button', { name: 'Cancel' }));

  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(createCategory).not.toHaveBeenCalled();
});

test('keeps the form after a category write failure', async () => {
  const createCategory = jest.fn(async () => {
    throw new Error('category write failed');
  });
  const user = userEvent.setup();
  await renderCreator({ createCategory });

  await user.type(screen.getByLabelText('Group name'), 'Weekend');
  await user.press(screen.getByRole('button', { name: 'Create group' }));

  await waitFor(() => expect(screen.getByText('category write failed')).toBeTruthy());
  expect(screen.getByLabelText('Group name').props.value).toBe('Weekend');
  expect(screen.getByRole('button', { name: 'Create group' }).props.accessibilityState.disabled).toBe(false);
});

test('retries only a failed category refresh after creation', async () => {
  const createCategory = jest.fn(async () => createdLeaf());
  const refreshCategories = jest
    .fn<Promise<void>, []>()
    .mockRejectedValueOnce(new Error('category read failed'))
    .mockResolvedValueOnce(undefined);
  const onCreated = jest.fn();
  const onCancel = jest.fn();
  const user = userEvent.setup();
  await renderCreator({
    intent: { kind: 'leaf', groupId: foodId },
    createCategory,
    refreshCategories,
    onCreated,
    onCancel,
  });

  await user.type(screen.getByLabelText('Leaf name'), 'Market');
  await user.press(screen.getByRole('button', { name: 'Create leaf' }));

  await waitFor(() => expect(screen.getByText('category read failed')).toBeTruthy());
  expect(createCategory).toHaveBeenCalledTimes(1);
  expect(onCreated).toHaveBeenCalledTimes(1);
  expect(onCancel).not.toHaveBeenCalled();

  await user.press(screen.getByRole('button', { name: 'Retry category refresh' }));
  await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
  expect(createCategory).toHaveBeenCalledTimes(1);
  expect(refreshCategories).toHaveBeenCalledTimes(2);
});
