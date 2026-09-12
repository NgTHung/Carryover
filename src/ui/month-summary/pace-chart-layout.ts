import type {
  PeriodHistory,
  PeriodHistoryPoint,
} from '../../reports/period-history-types';

export type PaceChartPoint = {
  x: number;
  y: number;
};

export type PaceChartLayout = {
  width: number;
  height: number;
  actual: readonly PaceChartPoint[];
  reference: readonly PaceChartPoint[];
  actualEnd: PaceChartPoint | null;
  referenceEnd: PaceChartPoint | null;
};

export const PACE_CHART_WIDTH = 320;
export const PACE_CHART_HEIGHT = 180;

export const PACE_CHART_PLOT_LEFT = 8;
export const PACE_CHART_PLOT_RIGHT = 8;
export const PACE_CHART_PLOT_TOP = 14;
export const PACE_CHART_PLOT_BOTTOM = 24;

function pointX(day: number, dayCount: number, width: number): number {
  const plotWidth = width - PACE_CHART_PLOT_LEFT - PACE_CHART_PLOT_RIGHT;
  return dayCount <= 1
    ? PACE_CHART_PLOT_LEFT
    : PACE_CHART_PLOT_LEFT + ((day - 1) / (dayCount - 1)) * plotWidth;
}

function pointY(amount: number, maximum: number, height: number): number {
  const plotHeight = height - PACE_CHART_PLOT_TOP - PACE_CHART_PLOT_BOTTOM;
  return height - PACE_CHART_PLOT_BOTTOM - (amount / maximum) * plotHeight;
}

function projectPoints(
  points: readonly PeriodHistoryPoint[],
  maximum: number,
  dayCount: number,
  width: number,
  height: number
): PaceChartPoint[] {
  return points.map((point) => ({
    x: pointX(point.day, dayCount, width),
    y: pointY(point.amount, maximum, height),
  }));
}

function staircasePoints(
  points: readonly PeriodHistoryPoint[],
  maximum: number,
  dayCount: number,
  width: number,
  height: number
): PaceChartPoint[] {
  const projected = projectPoints(points, maximum, dayCount, width, height);
  const staircase: PaceChartPoint[] = [];
  projected.forEach((point, index) => {
    staircase.push(point);
    const next = projected[index + 1];
    if (next !== undefined) {
      staircase.push({ x: next.x, y: point.y });
    }
  });
  return staircase;
}

export function paceChartLayout(
  history: PeriodHistory,
  width = PACE_CHART_WIDTH,
  height = PACE_CHART_HEIGHT
): PaceChartLayout {
  const amounts = [
    ...history.actualPoints.map((point) => point.amount),
    ...(history.reference.status === 'available'
      ? history.reference.points.map((point) => point.amount)
      : []),
  ];
  const maximum = Math.max(1, ...amounts);
  const dayCount = history.days.length;
  const actual = projectPoints(
    history.actualPoints,
    maximum,
    dayCount,
    width,
    height
  );
  const reference =
    history.reference.status === 'available'
      ? staircasePoints(
          history.reference.points,
          maximum,
          dayCount,
          width,
          height
        )
      : [];

  return {
    width,
    height,
    actual,
    reference,
    actualEnd: actual[actual.length - 1] ?? null,
    referenceEnd: reference[reference.length - 1] ?? null,
  };
}

export function pacePath(points: readonly PaceChartPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

export function paceDayAtX(
  locationX: number,
  dayCount: number,
  maximumDay = dayCount,
  width = PACE_CHART_WIDTH
): number {
  const selectableDayCount = Math.min(dayCount, Math.max(0, maximumDay));
  if (dayCount <= 0 || selectableDayCount <= 0) return 0;
  const plotWidth = width - PACE_CHART_PLOT_LEFT - PACE_CHART_PLOT_RIGHT;
  const normalized = (locationX - PACE_CHART_PLOT_LEFT) / plotWidth;
  const day = Math.round(normalized * (dayCount - 1)) + 1;
  return Math.min(selectableDayCount, Math.max(1, day));
}

export function paceChartPlotBounds(width = PACE_CHART_WIDTH) {
  return { left: PACE_CHART_PLOT_LEFT, right: width - PACE_CHART_PLOT_RIGHT };
}
