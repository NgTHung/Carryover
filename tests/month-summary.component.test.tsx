import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import type { LedgerChangeListener } from '../src/data/ledger-change-notifier';
import { FIXTURE_MONTH_SUMMARY } from '../src/reports/month-summary-fixture';
import type { MonthSummaryData } from '../src/data/month-summary';
import NativeMonthSummaryScreen from '../src/app/summary';
import WebMonthSummaryScreen from '../src/app/summary.web';
import {
  MonthSummaryView,
  type MonthSummaryLoadState,
} from '../src/ui/month-summary/MonthSummaryView';
import { CumulativePaceChart } from '../src/ui/month-summary/CumulativePaceChart';
import { useTransactionFilters } from '../src/ui/transactions/transaction-filters';

jest.mock('../src/ui/ledger-access', () => ({
  getMonthSummaryData: jest.fn(),
  subscribeLedgerChanges: jest.fn(),
}));

afterEach(() => {
  cleanup();
  useTransactionFilters.getState().reset();
});

test('renders ranked groups, expandable leaves, quality labels, and regret', async () => {
  const user = userEvent.setup();
  const state: MonthSummaryLoadState = {
    status: 'ready',
    summary: FIXTURE_MONTH_SUMMARY,
  };

  await render(
    <MonthSummaryView
      state={state}
      period="2026-09"
      onChangePeriod={jest.fn()}
      onRetry={jest.fn()}
    />
  );

  expect(screen.getByText('Spend by group')).toBeTruthy();
  expect(screen.getByText('Quality')).toBeTruthy();
  expect(screen.getByText('₫1.000.000 regretted this month.')).toBeTruthy();
  expect(screen.getByText('2 unknown drafts excluded from these totals.')).toBeTruthy();
  expect(screen.getByText('Unrated')).toBeTruthy();
  expect(screen.getByText('Need, ₫2.000.000')).toBeTruthy();
  expect(screen.getByText('Want, ₫1.200.000')).toBeTruthy();
  expect(screen.getByText('Regret, ₫1.000.000')).toBeTruthy();
  expect(screen.queryByText('Groceries')).toBeNull();

  await user.press(screen.getByRole('button', { name: /Food, ₫2\.200\.000/ }));
  expect(screen.getByText('Groceries')).toBeTruthy();
  expect(screen.getByText('Eating out')).toBeTruthy();
});

test('keeps amounts out of loading and unavailable states', async () => {
  const { rerender } = await render(
    <MonthSummaryView
      state={{ status: 'loading' }}
      period="2026-09"
      onChangePeriod={jest.fn()}
      onRetry={jest.fn()}
    />
  );

  expect(screen.getByText('Loading month summary…')).toBeTruthy();
  expect(screen.queryByText(/₫/)).toBeNull();

  await rerender(
    <MonthSummaryView
      state={{ status: 'unavailable' }}
      period="2026-09"
      onChangePeriod={jest.fn()}
      onRetry={jest.fn()}
    />
  );

  expect(screen.getByText('Summary unavailable')).toBeTruthy();
  expect(screen.queryByText('₫0')).toBeNull();
});

test('reports an error and retries through the view action', async () => {
  const retry = jest.fn();
  const user = userEvent.setup();
  await render(
    <MonthSummaryView
      state={{ status: 'error', message: 'Ledger unavailable' }}
      period="2026-09"
      onChangePeriod={jest.fn()}
      onRetry={retry}
    />
  );

  expect(screen.getByRole('alert')).toHaveTextContent('Ledger unavailable');
  await user.press(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

test('native route uses the shared period store and rereads on period and ledger changes', async () => {
  useTransactionFilters.getState().setSelectedPeriod('2026-09');
  let listener: LedgerChangeListener | undefined;
  const readMonthSummary = jest.fn(async (period: unknown) =>
    period === '2026-09' ? FIXTURE_MONTH_SUMMARY : undefined
  );
  const data: MonthSummaryData<'async'> = { readMonthSummary };
  const subscribe = jest.fn((next: LedgerChangeListener) => {
    listener = next;
    return () => undefined;
  });
  const user = userEvent.setup();

  await render(<NativeMonthSummaryScreen data={data} subscribe={subscribe} />);
  await waitFor(() => expect(screen.getByText('Spend by group')).toBeTruthy());
  expect(readMonthSummary).toHaveBeenCalledWith('2026-09');

  await user.press(screen.getByRole('button', { name: 'Next period' }));
  await waitFor(() => expect(readMonthSummary).toHaveBeenLastCalledWith('2026-10'));
  expect(screen.getByText('Summary unavailable')).toBeTruthy();

  await act(async () => {
    listener?.({ table: 'transactions', mutation: 'edited' });
  });
  await waitFor(() => expect(readMonthSummary).toHaveBeenCalledTimes(3));
  expect(subscribe).toHaveBeenCalledTimes(2);
});

test('browser route stays on fixture data and names the preview boundary', async () => {
  await render(<WebMonthSummaryScreen />);

  expect(screen.getByText('Browser preview. This report uses fixture data and does not connect to the ledger.')).toBeTruthy();
  expect(screen.getByText('Month summary')).toBeTruthy();
  expect(screen.getByText('Spend by group')).toBeTruthy();
});

test('renders pace lines, direct labels, and a neutral usual-pace caption', async () => {
  await render(<CumulativePaceChart history={FIXTURE_MONTH_SUMMARY.history} />);

  expect(screen.getByText('Pace')).toBeTruthy();
  expect(screen.getByTestId('summary-pace-actual-line')).toBeTruthy();
  expect(screen.getByTestId('summary-pace-reference-line')).toBeTruthy();
  expect(screen.getByText('₫100.000 above your usual pace by day 14.')).toBeTruthy();
  expect(screen.queryByText(/arrow|congrat/i)).toBeNull();
});

test('names one previous period and explains an unavailable reference', async () => {
  const onePrevious = {
    ...FIXTURE_MONTH_SUMMARY.history,
    reference: {
      status: 'available' as const,
      label: 'August 2026',
      sampleCount: 1,
      points: FIXTURE_MONTH_SUMMARY.history.reference.status === 'available'
        ? FIXTURE_MONTH_SUMMARY.history.reference.points
        : [],
    },
  };
  const { rerender } = await render(<CumulativePaceChart history={onePrevious} />);
  expect(screen.getByText('₫100.000 above August 2026\'s pace by day 14.')).toBeTruthy();

  await rerender(
    <CumulativePaceChart
      history={{
        ...FIXTURE_MONTH_SUMMARY.history,
        reference: { status: 'none' },
        gap: null,
      }}
    />
  );
  expect(screen.getByText('No previous month to compare yet.')).toBeTruthy();
  expect(screen.queryByTestId('summary-pace-reference-line')).toBeNull();
});

test('scrubbing shows both series values and releases the crosshair', async () => {
  await render(<CumulativePaceChart history={FIXTURE_MONTH_SUMMARY.history} />);
  const scrubber = screen.getByTestId('summary-pace-scrubber');
  const responderProps = scrubber.props as {
    onResponderMove?: (event: { nativeEvent: { locationX: number } }) => void;
    onResponderRelease?: () => void;
  };

  await act(async () => {
    responderProps.onResponderMove?.({ nativeEvent: { locationX: 8 } });
  });
  expect(screen.getByTestId('summary-pace-scrub-value')).toHaveTextContent('Day 1: You ₫0. Reference ₫100.000.');
  expect(screen.getByTestId('summary-pace-scrub-value').props.accessibilityLabel).toContain('Day 1');

  await act(async () => {
    responderProps.onResponderRelease?.();
  });
  expect(screen.queryByTestId('summary-pace-scrub-value')).toBeNull();
});
