import { useState } from 'react';
import { Text, View, useColorScheme } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { uiTokens } from '../tokens';
import type { PeriodHistory } from '../../reports/period-history-types';
import {
  formatPaceCaption,
  formatPaceValue,
} from './month-summary-presentation';
import {
  paceChartLayout,
  paceChartPlotBounds,
  paceDayAtX,
  pacePath,
  PACE_CHART_PLOT_BOTTOM,
  PACE_CHART_PLOT_TOP,
  PACE_CHART_HEIGHT,
  PACE_CHART_WIDTH,
} from './pace-chart-layout';

function amountAtDay(
  history: PeriodHistory,
  day: number,
  series: 'actual' | 'reference'
): number | null {
  const points =
    series === 'actual'
      ? history.actualPoints
      : history.reference.status === 'available'
        ? history.reference.points
        : [];
  return points.find((point) => point.day === day)?.amount ?? null;
}

function scrubAccessibilityLabel(history: PeriodHistory, day: number): string {
  const actual = amountAtDay(history, day, 'actual');
  const reference = amountAtDay(history, day, 'reference');
  const actualText = actual === null ? 'Not yet' : formatPaceValue(actual);
  const referenceText = reference === null ? 'No reference value' : formatPaceValue(reference);
  return `Day ${day}. You ${actualText}. Reference ${referenceText}.`;
}

export function CumulativePaceChart({ history }: { history: PeriodHistory }) {
  const [scrubDay, setScrubDay] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(PACE_CHART_WIDTH);
  const dark = useColorScheme() === 'dark';
  const colors = uiTokens.colors;
  const actualColor = dark ? colors['need-dark'] : colors['need-light'];
  const referenceColor = dark ? colors['muted-dark'] : colors['muted-light'];
  const faintColor = dark ? colors['faint-dark'] : colors['faint-light'];
  const layout = paceChartLayout(history, chartWidth);
  const scrubLimit = history.cutoffDay > 0 ? history.cutoffDay : 0;
  const scrubbed = scrubDay === null ? null : history.days[scrubDay - 1];
  const caption = formatPaceCaption(history);

  return (
    <View className="gap-3" testID="summary-pace">
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          Pace
        </Text>
        <Text className="text-detail text-muted-light dark:text-muted-dark">
          Cumulative spending against your previous periods.
        </Text>
      </View>

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Cumulative pace. ${caption}`}
        className="overflow-hidden rounded-surface border border-faint-light bg-surface-light p-2 dark:border-faint-dark dark:bg-surface-dark"
        testID="summary-pace-chart"
      >
        <View
          className="relative"
          onLayout={(event) => {
            if (event.nativeEvent.layout.width > 0) {
              setChartWidth(event.nativeEvent.layout.width);
            }
          }}
          onResponderGrant={(event) => {
            if (scrubLimit > 0) {
              setScrubDay(paceDayAtX(event.nativeEvent.locationX, scrubLimit, chartWidth));
            }
          }}
          onResponderMove={(event) => {
            if (scrubLimit > 0) {
              setScrubDay(paceDayAtX(event.nativeEvent.locationX, scrubLimit, chartWidth));
            }
          }}
          onResponderRelease={() => setScrubDay(null)}
          onResponderTerminate={() => setScrubDay(null)}
          onStartShouldSetResponder={() => scrubLimit > 0}
          testID="summary-pace-scrubber"
        >
          <Svg
            accessible={false}
            height={PACE_CHART_HEIGHT}
            viewBox={`0 0 ${chartWidth} ${PACE_CHART_HEIGHT}`}
            width="100%"
          >
            <Line
              stroke={faintColor}
              strokeWidth={1}
              x1={paceChartPlotBounds(chartWidth).left}
              x2={paceChartPlotBounds(chartWidth).right}
              y1={PACE_CHART_HEIGHT - 24}
              y2={PACE_CHART_HEIGHT - 24}
            />
            {layout.reference.length > 0 ? (
              <Path
                d={pacePath(layout.reference)}
                fill="none"
                stroke={referenceColor}
                strokeDasharray="4 4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                testID="summary-pace-reference-line"
              />
            ) : null}
            {layout.actual.length > 0 ? (
              <Path
                d={pacePath(layout.actual)}
                fill="none"
                stroke={actualColor}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                testID="summary-pace-actual-line"
              />
            ) : null}
            {layout.actualEnd !== null ? (
              <>
                <Circle
                  cx={layout.actualEnd.x}
                  cy={layout.actualEnd.y}
                  fill={actualColor}
                  r={4}
                />
                <SvgText
                  fill={actualColor}
                  fontSize={11}
                  fontWeight="600"
                  textAnchor="end"
                  x={layout.actualEnd.x - 6}
                  y={layout.actualEnd.y - 8}
                >
                  you
                </SvgText>
              </>
            ) : null}
            {layout.referenceEnd !== null && history.reference.status === 'available' ? (
              <SvgText
                fill={referenceColor}
                fontSize={11}
                fontWeight="600"
                textAnchor="end"
                x={layout.referenceEnd.x - 2}
                y={layout.referenceEnd.y - 8}
              >
                {history.reference.label}
              </SvgText>
            ) : null}
            {scrubbed !== undefined ? (
              <Line
                stroke={faintColor}
                strokeWidth={1}
                x1={layout.actual[scrubDay === null ? 0 : scrubDay - 1]?.x ?? 0}
                x2={layout.actual[scrubDay === null ? 0 : scrubDay - 1]?.x ?? 0}
                y1={PACE_CHART_PLOT_TOP}
                y2={PACE_CHART_HEIGHT - PACE_CHART_PLOT_BOTTOM}
              />
            ) : null}
            <SvgText
              fill={faintColor}
              fontSize={10}
              textAnchor="start"
              x={paceChartPlotBounds(chartWidth).left}
              y={PACE_CHART_HEIGHT - 8}
            >
              1
            </SvgText>
            <SvgText
              fill={faintColor}
              fontSize={10}
              textAnchor="end"
              x={paceChartPlotBounds(chartWidth).right}
              y={PACE_CHART_HEIGHT - 8}
            >
              {history.days.length}
            </SvgText>
          </Svg>
        </View>
        {scrubbed !== undefined && scrubDay !== null ? (
          <Text
            accessibilityLabel={scrubAccessibilityLabel(history, scrubDay)}
            className="text-detail tabular-nums text-muted-light dark:text-muted-dark"
            testID="summary-pace-scrub-value"
          >
            Day {scrubDay}: You {amountAtDay(history, scrubDay, 'actual') === null ? 'not yet' : formatPaceValue(amountAtDay(history, scrubDay, 'actual') ?? 0)}. Reference {amountAtDay(history, scrubDay, 'reference') === null ? 'not available' : formatPaceValue(amountAtDay(history, scrubDay, 'reference') ?? 0)}.
          </Text>
        ) : null}
      </View>

      <Text className="text-body tabular-nums text-muted-light dark:text-muted-dark">
        {caption}
      </Text>
    </View>
  );
}
