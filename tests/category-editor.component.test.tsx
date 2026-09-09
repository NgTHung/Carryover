import {
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import type {
  Category,
  CategoryGroupWithLeaves,
} from '../src/data/category-types';
import type { CategoryEditorData } from '../src/ui/categories/category-editor-contract';
import CategoryEditorScreen from '../src/app/settings/categories';

jest.mock('../src/data/database', () => ({ categoryData: {} }));

const foodId = '10000000-0000-4000-8000-000000000001';
const coffeeId = '10000000-0000-4000-8000-000000000002';
const groceriesId = '20000000-0000-4000-8000-000000000001';

function group(
  id: string,
  name: string,
  sort: number,
  leaves: CategoryGroupWithLeaves['leaves'] = [],
  isSuggestion = false
): CategoryGroupWithLeaves {
  return {
    level: 'group',
    id,
    name,
    sort,
    kind: 'spend',
    isSuggestion,
    deletedAt: null,
    leaves,
  };
}

function leaf(id: string, name: string, groupValue: CategoryGroupWithLeaves): CategoryGroupWithLeaves['leaves'][number] {
  return {
    level: 'leaf',
    id,
    name,
    sort: 0,
    kind: groupValue.kind,
    isSuggestion: groupValue.isSuggestion,
    deletedAt: null,
    group: {
      level: 'group',
      id: groupValue.id,
      name: groupValue.name,
      sort: groupValue.sort,
      kind: groupValue.kind,
    },
  };
}

function createRepository() {
  const food = group(foodId, 'Food', 0, [], true);
  food.leaves = [leaf(groceriesId, 'Groceries', food)];
  const coffee = group(coffeeId, 'Coffee', 1, [], true);
  let groups: CategoryGroupWithLeaves[] = [food, coffee];

  const data: CategoryEditorData = {
    listActiveCategoryGroups: jest.fn(async () => groups),
    createCategory: jest.fn(async (input): Promise<Category> => {
      if (input.level === 'group') {
        const created = group('30000000-0000-4000-8000-000000000001', input.name, groups.length);
        created.kind = input.kind;
        groups = [...groups, created];
        return created;
      }
      const parent = groups.find((item) => item.id === input.groupId);
      if (!parent) throw new Error('Active category group was not found');
      const created = leaf('40000000-0000-4000-8000-000000000001', input.name, parent);
      parent.leaves = [...parent.leaves, created];
      return created;
    }),
    renameCategory: jest.fn(async ({ categoryId, name }) => {
      for (const item of groups) {
        if (item.id === categoryId) item.name = name;
        for (const child of item.leaves) {
          if (child.id === categoryId) child.name = name;
        }
      }
    }),
    setCategoryGroupKind: jest.fn(async ({ groupId, kind }) => {
      const item = groups.find((candidate) => candidate.id === groupId);
      if (!item) throw new Error('Active category group was not found');
      item.kind = kind;
      item.leaves = item.leaves.map((child) => ({ ...child, kind }));
    }),
    reorderCategories: jest.fn(async (input) => {
      if (input.level === 'group') {
        const byId = new Map(groups.map((item) => [item.id, item]));
        groups = input.categoryIds.map((id) => byId.get(id)).filter((item): item is CategoryGroupWithLeaves => item !== undefined);
      } else {
        const item = groups.find((candidate) => candidate.id === input.groupId);
        if (item) {
          const byId = new Map(item.leaves.map((child) => [child.id, child]));
          item.leaves = input.categoryIds
            .map((id) => byId.get(id))
            .filter((child): child is CategoryGroupWithLeaves['leaves'][number] => child !== undefined);
        }
      }
    }),
    softDeleteCategory: jest.fn(async (categoryId) => {
      groups = groups
        .filter((item) => item.id !== categoryId)
        .map((item) => ({ ...item, leaves: item.leaves.filter((child) => child.id !== categoryId) }));
    }),
    deleteSuggestedCategories: jest.fn(async () => {
      groups = groups.filter((item) => !item.isSuggestion);
    }),
  };
  return { data, getGroups: () => groups };
}

afterEach(() => {
  cleanup();
});

test('creates a group through the shared category data boundary', async () => {
  const repository = createRepository();
  const user = userEvent.setup();
  await render(<CategoryEditorScreen data={repository.data} />);
  await waitFor(() => expect(screen.getByText('Food')).toBeTruthy());

  await user.press(screen.getByRole('button', { name: 'Add group' }));
  await user.type(screen.getByLabelText('Group name'), 'Weekend');
  await user.press(screen.getByRole('button', { name: 'Save group' }));

  expect(repository.data.createCategory).toHaveBeenCalledWith({
    level: 'group',
    name: 'Weekend',
    kind: 'spend',
  });
  await waitFor(() => expect(screen.getByText('Weekend')).toBeTruthy());
});

test('shows validation feedback before trying to create a blank group', async () => {
  const repository = createRepository();
  const user = userEvent.setup();
  await render(<CategoryEditorScreen data={repository.data} />);
  await waitFor(() => expect(screen.getByText('Food')).toBeTruthy());

  await user.press(screen.getByRole('button', { name: 'Add group' }));
  await user.press(screen.getByRole('button', { name: 'Save group' }));

  expect(screen.getByText('Enter a category name')).toBeTruthy();
  expect(repository.data.createCategory).not.toHaveBeenCalled();
});

test('keeps an open leaf form after changing kind and category order', async () => {
  const repository = createRepository();
  const user = userEvent.setup();
  await render(<CategoryEditorScreen data={repository.data} />);
  await waitFor(() => expect(screen.getByText('Food')).toBeTruthy());

  await user.press(screen.getByRole('button', { name: 'Add leaf to Food' }));
  await user.type(screen.getByLabelText('Leaf name'), 'Bakery');
  await user.press(screen.getAllByRole('button', { name: 'Reserve' })[0]);

  await waitFor(() => expect(screen.getByLabelText('Leaf name').props.value).toBe('Bakery'));
  expect(screen.getByText('Reserve group')).toBeTruthy();

  await user.press(screen.getByRole('button', { name: 'Move Food down' }));

  await waitFor(() => expect(screen.getByLabelText('Leaf name').props.value).toBe('Bakery'));
  expect(repository.data.reorderCategories).toHaveBeenCalledWith({
    level: 'group',
    categoryIds: [coffeeId, foodId],
  });
});

test('adjusts the category list around the iOS keyboard', async () => {
  const repository = createRepository();
  await render(<CategoryEditorScreen data={repository.data} />);
  await waitFor(() => expect(screen.getByText('Food')).toBeTruthy());

  const scrollView = screen.getByTestId('category-list');
  expect(scrollView.props.automaticallyAdjustKeyboardInsets).toBe(true);
  expect(scrollView.props.keyboardDismissMode).toBe('interactive');
});

test('deletes a category after the inline confirmation', async () => {
  const repository = createRepository();
  const user = userEvent.setup();
  await render(<CategoryEditorScreen data={repository.data} />);
  await waitFor(() => expect(screen.getByText('Food')).toBeTruthy());

  await user.press(screen.getByRole('button', { name: 'Delete Food' }));
  expect(screen.getByText('Delete Food and its 1 leaves?')).toBeTruthy();
  await user.press(screen.getByRole('button', { name: 'Confirm delete' }));

  expect(repository.data.softDeleteCategory).toHaveBeenCalledWith(foodId);
  await waitFor(() => expect(screen.queryByText('Food')).toBeNull());
});

test('deletes seeded suggestions in one action', async () => {
  const repository = createRepository();
  const user = userEvent.setup();
  await render(<CategoryEditorScreen data={repository.data} />);
  await waitFor(() => expect(screen.getByText('Delete suggested categories (3)')).toBeTruthy());

  await user.press(screen.getByRole('button', { name: 'Delete suggested categories (3)' }));

  expect(repository.data.deleteSuggestedCategories).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByText('Delete suggested categories (3)')).toBeNull());
});
