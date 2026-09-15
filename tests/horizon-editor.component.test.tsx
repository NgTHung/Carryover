import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import type { MonthConfig } from '../src/data/month-config-validation';
import { HorizonForm } from '../src/ui/horizon/HorizonForm';
import type { HorizonEditorData } from '../src/ui/horizon/horizon-editor-contract';

const config: MonthConfig = {
  period: '2026-09',
  openingBalance: 1_000_000,
  incomeTotal: 2_000_000,
  reservedTotal: 300_000,
  horizonDate: '2026-09-30',
};

function editorData(): HorizonEditorData {
  return {
    readMonthConfig: jest.fn(async () => config),
    updateHorizon: jest.fn(async () => config),
  };
}

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

test('seeds the stored date and exposes the selected period and accessible field', async () => {
  await render(
    <HorizonForm
      period={config.period}
      config={config}
      data={editorData()}
      onCancel={jest.fn()}
      onSaved={jest.fn()}
    />
  );

  expect(screen.getByRole('header', { name: 'Change horizon' })).toBeTruthy();
  expect(screen.getByText('Period: September 2026')).toBeTruthy();
  expect(screen.getByLabelText('Horizon').props.value).toBe('2026-09-30');
  expect(screen.getByLabelText('Horizon').props.keyboardType).toBe(
    'numbers-and-punctuation'
  );
});

test('valid changes, including dates beyond period end, submit the exact pair once', async () => {
  const data = editorData();
  const onSaved = jest.fn();
  await render(
    <HorizonForm
      period={config.period}
      config={config}
      data={data}
      onCancel={jest.fn()}
      onSaved={onSaved}
    />
  );

  await fireEvent.changeText(screen.getByLabelText('Horizon'), '2026-10-15');
  await fireEvent.press(screen.getByRole('button', { name: 'Save horizon' }));

  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(data.updateHorizon).toHaveBeenCalledTimes(1);
  expect(data.updateHorizon).toHaveBeenCalledWith({
    period: '2026-09',
    horizonDate: '2026-10-15',
  });
});

test('invalid dates show field feedback without calling the write boundary', async () => {
  const data = editorData();
  await render(
    <HorizonForm
      period={config.period}
      config={config}
      data={data}
      onCancel={jest.fn()}
      onSaved={jest.fn()}
    />
  );

  await fireEvent.changeText(screen.getByLabelText('Horizon'), '2026-9-30');
  await fireEvent.press(screen.getByRole('button', { name: 'Save horizon' }));

  expect(screen.getByText('date must be YYYY-MM-DD')).toBeTruthy();
  expect(data.updateHorizon).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Horizon').props.value).toBe('2026-9-30');
});

test('a failed write preserves text and a retry can succeed', async () => {
  const updateHorizon = jest
    .fn()
    .mockRejectedValueOnce(new Error('database is locked'))
    .mockResolvedValue(config);
  const data: HorizonEditorData = {
    readMonthConfig: jest.fn(async () => config),
    updateHorizon,
  };
  const onSaved = jest.fn();
  await render(
    <HorizonForm
      period={config.period}
      config={config}
      data={data}
      onCancel={jest.fn()}
      onSaved={onSaved}
    />
  );

  await fireEvent.changeText(screen.getByLabelText('Horizon'), '2027-01-01');
  await fireEvent.press(screen.getByRole('button', { name: 'Save horizon' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/database is locked/));
  expect(screen.getByLabelText('Horizon').props.value).toBe('2027-01-01');

  await fireEvent.press(screen.getByRole('button', { name: 'Save horizon' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(updateHorizon).toHaveBeenCalledTimes(2);
  expect(updateHorizon).toHaveBeenLastCalledWith({
    period: '2026-09',
    horizonDate: '2027-01-01',
  });
});

test('saving locks edits and cancellation until the deferred write settles', async () => {
  let resolveWrite: () => void = () => undefined;
  const write = new Promise<MonthConfig>((resolve) => {
    resolveWrite = () => resolve(config);
  });
  const data: HorizonEditorData = {
    readMonthConfig: jest.fn(async () => config),
    updateHorizon: jest.fn(() => write),
  };
  const onCancel = jest.fn();
  const onWritePending = jest.fn();
  await render(
    <HorizonForm
      period={config.period}
      config={config}
      data={data}
      onCancel={onCancel}
      onSaved={jest.fn()}
      onWritePending={onWritePending}
    />
  );

  await fireEvent.changeText(screen.getByLabelText('Horizon'), '2026-10-15');
  await fireEvent.press(screen.getByRole('button', { name: 'Save horizon' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save horizon' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

  expect(data.updateHorizon).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Horizon').props.editable).toBe(false);
  expect(screen.getByRole('button', { name: 'Cancel' }).props.accessibilityState.disabled).toBe(true);
  expect(onCancel).not.toHaveBeenCalled();
  expect(onWritePending).toHaveBeenLastCalledWith(true);

  await act(async () => {
    resolveWrite();
    await write;
  });
  await waitFor(() => expect(onWritePending).toHaveBeenLastCalledWith(false));
});

test('cancel performs no mutation and a background config refresh does not erase dirty text', async () => {
  const data = editorData();
  const onCancel = jest.fn();
  const view = await render(
    <HorizonForm
      period={config.period}
      config={config}
      data={data}
      onCancel={onCancel}
      onSaved={jest.fn()}
    />
  );

  await fireEvent.changeText(screen.getByLabelText('Horizon'), '2026-10-15');
  await view.rerender(
    <HorizonForm
      period={config.period}
      config={{ ...config, horizonDate: '2026-11-01' }}
      data={data}
      onCancel={onCancel}
      onSaved={jest.fn()}
    />
  );

  expect(screen.getByLabelText('Horizon').props.value).toBe('2026-10-15');
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(data.updateHorizon).not.toHaveBeenCalled();
});
