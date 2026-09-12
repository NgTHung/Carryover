import { cleanup, render, screen, userEvent } from '@testing-library/react-native';

import type { PeriodHistory, PeriodHistoryDay } from '../src/reports/period-history-types';
import { FIXTURE_MONTH_SUMMARY } from '../src/reports/month-summary-fixture';
import { DayCalendar } from '../src/ui/month-summary/DayCalendar';

afterEach(() => {
  cleanup();
});

function historyWithCalendarDetails(): PeriodHistory {
  const days = FIXTURE_MONTH_SUMMARY.history.days.map((day) => ({ ...day }));
  const update = (day: number, changes: Partial<PeriodHistoryDay>) => {
    const index = days.findIndex((candidate) => candidate.day === day);
    const current = days[index];
    if (current === undefined) throw new Error(`missing fixture day ${day}`);
    days[index] = { ...current, ...changes };
  };

  update(1, {
    spend: 50_000,
    spendStep: 1,
    unknownDrafts: 1,
    transactions: [
      {
        id: 'groceries',
        direction: 'expense',
        status: 'complete',
        amount: 50_000,
        label: 'Groceries',
      },
      {
        id: 'unknown-draft',
        direction: 'expense',
        status: 'draft',
        amount: null,
        label: 'No leaf category',
      },
    ],
  });
  update(2, { spend: 100_000, spendStep: 2 });
  update(3, { spend: 150_000, spendStep: 3 });
  update(4, { spend: 200_000, spendStep: 4 });
  update(8, { income: 900_000 });

  return { ...FIXTURE_MONTH_SUMMARY.history, days };
}

test('renders the ramp, calendar states, and income marker', async () => {
  await render(<DayCalendar history={historyWithCalendarDetails()} />);

  expect(screen.getByText('Day calendar')).toBeTruthy();
  expect(screen.getByTestId('summary-calendar-leading-0')).toBeTruthy();
  expect(screen.getByTestId('summary-calendar-day-1').props.style).toEqual(
    expect.objectContaining({ minHeight: 44 })
  );
  expect(screen.getByTestId('summary-calendar-day-1').props.className).toContain('bg-spend-1');
  expect(screen.getByTestId('summary-calendar-day-2').props.className).toContain('bg-spend-2');
  expect(screen.getByTestId('summary-calendar-day-3').props.className).toContain('bg-spend-3');
  expect(screen.getByTestId('summary-calendar-day-4').props.className).toContain('bg-spend-4');
  expect(screen.getByTestId('summary-calendar-day-5').props.className).toContain('bg-surface');
  expect(screen.getByTestId('summary-calendar-day-14').props.className).toContain('border-2');
  expect(screen.getByTestId('summary-calendar-day-15').props.className).toContain('bg-transparent');
  expect(screen.getByTestId('summary-calendar-income-8')).toBeTruthy();
  expect(screen.getByTestId('summary-calendar-unknown-1')).toHaveTextContent('?');
  expect(screen.getByText('· spent nothing')).toBeTruthy();
  expect(screen.getByText('░▒▓█ spend ramp')).toBeTruthy();
  expect(screen.getByText('• income')).toBeTruthy();
  expect(screen.getByText('? unknown draft')).toBeTruthy();
  expect(screen.getByText('□ future')).toBeTruthy();
  expect(screen.queryByText(/streak|reward|best day/i)).toBeNull();
});

test('labels cells for VoiceOver and expands one transaction day at a time', async () => {
  const user = userEvent.setup();
  await render(<DayCalendar history={historyWithCalendarDetails()} />);

  const dayOne = screen.getByRole('button', { name: /^1 September 2026\./ });
  expect(dayOne.props.accessibilityLabel).toContain('Spent ₫50.000.');
  expect(dayOne.props.accessibilityLabel).toContain('1 unknown draft.');
  expect(dayOne.props.accessibilityLabel).toContain('No income.');
  expect(screen.getByRole('button', { name: /15 September 2026/ }).props.accessibilityLabel).toContain('Not yet');

  await user.press(dayOne);
  expect(screen.getByTestId('summary-day-details-1')).toBeTruthy();
  expect(screen.getByText('1 September 2026')).toBeTruthy();
  expect(screen.getByText('Groceries')).toBeTruthy();
  expect(screen.getByText('No leaf category, amount unknown')).toBeTruthy();

  const dayTwo = screen.getByRole('button', { name: /^2 September 2026\./ });
  await user.press(dayTwo);
  expect(screen.queryByTestId('summary-day-details-1')).toBeNull();
  expect(screen.getByTestId('summary-day-details-2')).toBeTruthy();

  await user.press(dayTwo);
  expect(screen.queryByTestId('summary-day-details-2')).toBeNull();
});
