import { cleanup, render, screen, userEvent } from '@testing-library/react-native';

import type { CategoryGroupWithLeaves } from '../src/data/category-types';
import { LeafSelector } from '../src/ui/categories/LeafSelector';

const groups: CategoryGroupWithLeaves[] = [
  {
    level: 'group',
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Food',
    sort: 0,
    kind: 'spend',
    isSuggestion: false,
    deletedAt: null,
    leaves: [
      {
        level: 'leaf',
        id: '20000000-0000-4000-8000-000000000001',
        name: 'Groceries',
        sort: 0,
        kind: 'spend',
        isSuggestion: false,
        deletedAt: null,
        group: {
          level: 'group',
          id: '10000000-0000-4000-8000-000000000001',
          name: 'Food',
          sort: 0,
          kind: 'spend',
        },
      },
    ],
  },
  {
    level: 'group',
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Travel',
    sort: 1,
    kind: 'spend',
    isSuggestion: false,
    deletedAt: null,
    leaves: [
      {
        level: 'leaf',
        id: '20000000-0000-4000-8000-000000000002',
        name: 'Groceries',
        sort: 0,
        kind: 'spend',
        isSuggestion: false,
        deletedAt: null,
        group: {
          level: 'group',
          id: '10000000-0000-4000-8000-000000000002',
          name: 'Travel',
          sort: 1,
          kind: 'spend',
        },
      },
    ],
  },
];

afterEach(cleanup);

function renderSelector(overrides: Partial<React.ComponentProps<typeof LeafSelector>> = {}) {
  return render(
    <LeafSelector
      groups={groups}
      selectedLeafId={null}
      disabled={false}
      onSelect={jest.fn()}
      {...overrides}
    />
  );
}

test('labels the search, groups duplicate leaves by heading, and selects by id', async () => {
  const onSelect = jest.fn();
  const user = userEvent.setup();
  await renderSelector({ onSelect });

  expect(screen.getByLabelText('Search leaves')).toBeTruthy();
  expect(screen.getAllByText('Food')).toHaveLength(1);
  expect(screen.getAllByText('Travel')).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'Groceries' })).toHaveLength(2);
  expect(screen.getAllByRole('button', { name: 'Groceries' })[1]?.props.accessibilityHint).toBe('Group: Travel');

  await user.press(screen.getAllByRole('button', { name: 'Groceries' })[1]!);
  expect(onSelect).toHaveBeenCalledWith('20000000-0000-4000-8000-000000000002');
});

test('shows the selected leaf separately when search filters it out', async () => {
  const user = userEvent.setup();
  await renderSelector({ selectedLeafId: groups[0]!.leaves[0]!.id });

  await user.type(screen.getByLabelText('Search leaves'), 'travel');
  expect(screen.getByText('Selected leaf')).toBeTruthy();
  expect(screen.getByText('Groceries · Food')).toBeTruthy();
  expect(screen.getByText('Travel')).toBeTruthy();
});

test('shows an empty result without writing or auto-selecting', async () => {
  const onSelect = jest.fn();
  const user = userEvent.setup();
  await renderSelector({ onSelect });

  await user.type(screen.getByLabelText('Search leaves'), 'missing');
  expect(screen.getByText('No matching leaves.')).toBeTruthy();
  expect(onSelect).not.toHaveBeenCalled();
});

test('disables search and leaf interaction together', async () => {
  const onSelect = jest.fn();
  const user = userEvent.setup();
  await renderSelector({ onSelect, disabled: true });

  expect(screen.getByLabelText('Search leaves').props.editable).toBe(false);
  const leafButtons = screen.getAllByRole('button', { name: 'Groceries' });
  expect(leafButtons).toHaveLength(2);
  expect(leafButtons[0]?.props.accessibilityState.disabled).toBe(true);
  await user.press(leafButtons[0]);
  expect(onSelect).not.toHaveBeenCalled();
});
