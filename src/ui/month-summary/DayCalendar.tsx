import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatVnd } from '../../money/currency';
import { periodWeekdayIndex } from '../../data/period';
import type {
  PeriodHistory,
  PeriodHistoryDay,
  SpendStep,
} from '../../reports/period-history-types';
import { DayTransactions, calendarDateLabel } from './DayTransactions';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

function spendClass(step: SpendStep): string {
  switch (step) {
    case 1:
      return 'bg-spend-1-light dark:bg-spend-1-dark';
    case 2:
      return 'bg-spend-2-light dark:bg-spend-2-dark';
    case 3:
      return 'bg-spend-3-light dark:bg-spend-3-dark';
    case 4:
      return 'bg-spend-4-light dark:bg-spend-4-dark';
    default:
      return 'bg-surface-light dark:bg-surface-dark';
  }
}

function dayAccessibilityLabel(day: PeriodHistoryDay): string {
  const date = calendarDateLabel(day.date);
  if (day.phase === 'future') return `${date}. Not yet.`;

  const spending =
    day.spend > 0
      ? `Spent ${formatVnd(day.spend)}.`
      : day.unknownDrafts > 0
        ? 'Known spending is unknown.'
        : 'Spent nothing.';
  const unknown =
    day.unknownDrafts === 0
      ? ''
      : ` ${day.unknownDrafts} unknown ${day.unknownDrafts === 1 ? 'draft' : 'drafts'}.`;
  const income = day.income > 0 ? ` Income ${formatVnd(day.income)}.` : ' No income.';
  return `${date}. ${spending}${unknown}${income}`;
}

function dayClass(day: PeriodHistoryDay): string {
  if (day.phase === 'future') {
    return 'border border-faint-light bg-transparent dark:border-faint-dark';
  }
  const todayClass =
    day.phase === 'today'
      ? 'border-2 border-ink-light dark:border-ink-dark'
      : 'border border-transparent';
  return `${todayClass} ${spendClass(day.spendStep)}`;
}

export function DayCalendar({ history }: { history: PeriodHistory }) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const firstDay = history.days[0];
  const leadingCells =
    firstDay === undefined
      ? 0
      : periodWeekdayIndex(firstDay.date.slice(0, 7), firstDay.day);
  const selectedDay =
    expandedDay === null
      ? undefined
      : history.days.find((day) => day.day === expandedDay);

  return (
    <View className="gap-3" testID="summary-calendar">
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          Day calendar
        </Text>
        <Text className="text-detail text-muted-light dark:text-muted-dark">
          Spending tint is compared with your per day figure.
        </Text>
      </View>

      <View className="gap-2 rounded-surface border border-faint-light bg-surface-light p-2 dark:border-faint-dark dark:bg-surface-dark">
        <View className="flex-row" accessible={false}>
          {WEEKDAYS.map((weekday, index) => (
            <Text
              key={`${weekday}-${index}`}
              className="text-center text-detail font-semibold text-muted-light dark:text-muted-dark"
              style={{ width: '14.2857%' }}
            >
              {weekday}
            </Text>
          ))}
        </View>

        <View className="flex-row flex-wrap gap-y-2" testID="summary-calendar-grid">
          {Array.from({ length: leadingCells }, (_, index) => (
            <View
              key={`leading-${index}`}
              accessible={false}
              style={{ aspectRatio: 1, width: '14.2857%' }}
              testID={`summary-calendar-leading-${index}`}
            />
          ))}
          {history.days.map((day) => {
            const expanded = expandedDay === day.day;
            return (
              <Pressable
                key={day.date}
                accessibilityRole="button"
                accessibilityLabel={dayAccessibilityLabel(day)}
                accessibilityState={{ expanded }}
                className={`min-h-touch items-center justify-center rounded-surface ${dayClass(day)}`}
                onPress={() => setExpandedDay(expanded ? null : day.day)}
                style={{ aspectRatio: 1, minHeight: 44, width: '14.2857%' }}
                testID={`summary-calendar-day-${day.day}`}
              >
                <Text className="text-body font-semibold tabular-nums text-ink-light dark:text-ink-dark">
                  {day.day}
                </Text>
                {day.income > 0 ? (
                  <View
                    accessible={false}
                    className="absolute right-1 top-1 h-2 w-2 rounded-chip bg-need-light dark:bg-need-dark"
                    testID={`summary-calendar-income-${day.day}`}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="flex-row flex-wrap gap-x-3 gap-y-1" accessible={false}>
        <Text className="text-detail text-muted-light dark:text-muted-dark">· spent nothing</Text>
        <Text className="text-detail text-muted-light dark:text-muted-dark">░▒▓█ spend ramp</Text>
        <Text className="text-detail text-muted-light dark:text-muted-dark">• income</Text>
        <Text className="text-detail text-muted-light dark:text-muted-dark">□ future</Text>
      </View>

      {selectedDay !== undefined ? <DayTransactions day={selectedDay} /> : null}
    </View>
  );
}
