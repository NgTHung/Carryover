import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import type { CommitmentOverview, CommitmentOverviewItem } from '../src/data/commitment-overview';
import type { CommitmentManagerData } from '../src/ui/commitments/commitment-manager-contract';
import { CommitmentManagerView } from '../src/ui/commitments/CommitmentManagerView';
import type { ReserveLeafChoice } from '../src/ui/commitments/commitment-form';

const leafId = '11111111-1111-4111-8111-111111111111';
const secondLeafId = '22222222-2222-4222-8222-222222222222';
const firstId = '33333333-3333-4333-8333-333333333333';
const secondId = '44444444-4444-4444-8444-444444444444';

const choices: ReserveLeafChoice[] = [
  { id: leafId, name: 'Rent', groupName: 'Housing' },
  { id: secondLeafId, name: 'Power', groupName: 'Housing' },
];

function item(
  id: string,
  name: string,
  state: CommitmentOverviewItem['state'],
  overrides: Partial<CommitmentOverviewItem> = {}
): CommitmentOverviewItem {
  return {
    commitment: {
      id,
      name,
      amount: 700_000,
      dueDay: 5,
      categoryId: leafId,
      active: state.status !== 'inactive',
      createdAt: new Date(2026, 8, 1),
      updatedAt: new Date(2026, 8, 1),
      deletedAt: null,
    },
    dueDate: '2026-09-05',
    leaf: { id: leafId, name: 'Rent', groupName: 'Housing', active: true },
    state,
    ...overrides,
  };
}

function overview(
  items: CommitmentOverviewItem[] = [],
  period: CommitmentOverview['period'] = '2026-09'
): CommitmentOverview {
  return {
    period,
    unpaidTotal: { status: 'available', amount: 700_000 },
    items,
  };
}

function data(overrides: Partial<CommitmentManagerData> = {}): CommitmentManagerData {
  return {
    readCommitmentOverview: jest.fn(async () => overview()),
    listActiveCategoryGroups: jest.fn(async () => []),
    createCommitment: jest.fn(async (input) => ({
      id: firstId,
      ...input,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })),
    editCommitment: jest.fn(async ({ commitmentId, changes }) => ({
      ...item(commitmentId, 'Rent', { status: 'unpaid', nextToAcceptPayment: true }).commitment,
      ...changes,
    })),
    softDeleteCommitment: jest.fn(async () => undefined),
    ...overrides,
  };
}

async function renderReady(
  items: CommitmentOverviewItem[] = [],
  options: {
    data?: CommitmentManagerData;
    choices?: ReserveLeafChoice[];
    period?: CommitmentOverview['period'];
    unpaidTotal?: CommitmentOverview['unpaidTotal'];
  } = {}
) {
  const managerData = options.data ?? data();
  const value = overview(items, options.period);
  if (options.unpaidTotal !== undefined) value.unpaidTotal = options.unpaidTotal;
  const onReload = jest.fn(async () => undefined);
  const onChangePeriod = jest.fn();
  const onOpenCategories = jest.fn();
  const onRecordPayment = jest.fn();
  const view = await render(
    <CommitmentManagerView
      state={{ status: 'ready', overview: value, choices: options.choices ?? choices }}
      data={managerData}
      onReload={onReload}
      onChangePeriod={onChangePeriod}
      onOpenCategories={onOpenCategories}
      onRecordPayment={onRecordPayment}
      now={() => new Date(2026, 8, 14)}
    />
  );
  return { view, managerData, onReload, onChangePeriod, onOpenCategories, onRecordPayment };
}

afterEach(async () => {
  await cleanup();
});

test('renders loading, retry, empty, and reserve-leaf prerequisite states', async () => {
  const managerData = data();
  const onReload = jest.fn(async () => undefined);
  const props = {
    data: managerData,
    onReload,
    onChangePeriod: jest.fn(),
    onOpenCategories: jest.fn(),
    onRecordPayment: jest.fn(),
  };
  const view = await render(<CommitmentManagerView state={{ status: 'loading' }} {...props} />);
  expect(screen.getByText('Loading commitments.')).toBeTruthy();
  await view.rerender(
    <CommitmentManagerView state={{ status: 'error', message: 'Read failed' }} {...props} />
  );
  await userEvent.setup().press(screen.getByRole('button', { name: 'Try again' }));
  expect(onReload).toHaveBeenCalledTimes(1);

  await view.rerender(
    <CommitmentManagerView
      state={{ status: 'ready', overview: overview(), choices: [] }}
      {...props}
    />
  );
  expect(screen.getByText('No commitments yet.')).toBeTruthy();
  expect(screen.getByText(/Create an active reserve leaf/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add commitment' }).props.accessibilityState.disabled).toBe(true);
});

test('shows data-owned totals and keeps recovery controls during overflow', async () => {
  await renderReady(
    [item(firstId, 'Rent', { status: 'unpaid', nextToAcceptPayment: true })],
    { unpaidTotal: { status: 'overflow' } }
  );
  expect(screen.getByText(/exceeds the safe VND limit/)).toBeTruthy();
  expect(screen.getByText('₫700.000 reserved, due day 5')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Deactivate' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
});

test('validates creation, retains failed input, and locks duplicate submission', async () => {
  let rejectCreate: (error: Error) => void = () => undefined;
  const pending = new Promise<never>((_resolve, reject) => {
    rejectCreate = reject;
  });
  const managerData = data({ createCommitment: jest.fn(() => pending) });
  await renderReady([], { data: managerData });
  const user = userEvent.setup();
  await user.press(screen.getByRole('button', { name: 'Add commitment' }));
  await user.press(screen.getByRole('button', { name: 'Save commitment' }));
  expect(screen.getByText('Enter a commitment name.')).toBeTruthy();
  expect(managerData.createCommitment).not.toHaveBeenCalled();

  await user.type(screen.getByLabelText('Commitment name'), 'Rent');
  await user.type(screen.getByLabelText('Reserve amount'), '700000');
  await user.type(screen.getByLabelText('Due day'), '5');
  await user.press(screen.getByRole('button', { name: 'Housing / Rent' }));
  await user.press(screen.getByRole('button', { name: 'Save commitment' }));
  await user.press(screen.getByRole('button', { name: 'Save commitment' }));
  expect(managerData.createCommitment).toHaveBeenCalledTimes(1);

  await act(async () => {
    rejectCreate(new Error('Write failed'));
    await pending.catch(() => undefined);
  });
  await waitFor(() => expect(screen.getAllByText('Write failed').length).toBeGreaterThan(0));
  expect(screen.getByLabelText('Commitment name').props.value).toBe('Rent');
  expect(screen.getByLabelText('Reserve amount').props.value).toBe('700000');
});

test('confirms deactivate and delete while reactivation stays explicit', async () => {
  const active = item(firstId, 'Rent', { status: 'unpaid', nextToAcceptPayment: true });
  const inactive = item(secondId, 'Power', { status: 'inactive' }, {
    commitment: {
      ...item(secondId, 'Power', { status: 'inactive' }).commitment,
      categoryId: secondLeafId,
    },
    leaf: { id: secondLeafId, name: 'Power', groupName: 'Housing', active: true },
  });
  const result = await renderReady([active, inactive]);
  const user = userEvent.setup();

  await user.press(screen.getByRole('button', { name: 'Deactivate' }));
  expect(screen.getByText(/stops this commitment from reserving money/)).toBeTruthy();
  await user.press(screen.getByRole('button', { name: 'Confirm deactivate' }));
  await waitFor(() => expect(result.managerData.editCommitment).toHaveBeenCalledWith({
    commitmentId: firstId, changes: { active: false },
  }));
  await waitFor(() => expect(result.onReload).toHaveBeenCalledTimes(1));

  await user.press(screen.getByRole('button', { name: 'Reactivate' }));
  await waitFor(() => expect(result.managerData.editCommitment).toHaveBeenCalledWith({
    commitmentId: secondId, changes: { active: true },
  }));
  await waitFor(() => expect(result.onReload).toHaveBeenCalledTimes(2));

  await user.press(screen.getAllByRole('button', { name: 'Delete' })[0]);
  expect(screen.getByText(/Existing transactions stay in the ledger/)).toBeTruthy();
  await user.press(screen.getByRole('button', { name: 'Confirm delete' }));
  await waitFor(() => expect(result.managerData.softDeleteCommitment).toHaveBeenCalledWith(firstId));
  await waitFor(() => expect(result.onReload).toHaveBeenCalledTimes(3));
});

test('offers payment only for the next unpaid row and disables future payment', async () => {
  const next = item(firstId, 'First rent', { status: 'unpaid', nextToAcceptPayment: true });
  const later = item(secondId, 'Second rent', { status: 'unpaid', nextToAcceptPayment: false });
  const current = await renderReady([next, later]);
  expect(screen.getAllByRole('button', { name: 'Record payment' })).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Record payment' }));
  expect(current.onRecordPayment).toHaveBeenCalledWith(firstId, '2026-09');

  await cleanup();
  await renderReady([next, later], { period: '2026-10' });
  expect(screen.getByText(/Future periods cannot record payments/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Record payment' }).props.accessibilityState.disabled).toBe(true);
});
