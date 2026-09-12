import { formatVnd, formatVndCompact } from '../../money/currency';
import type { MonthSummary, QualityBucket } from '../../reports/month-summary';
import type { PeriodHistory } from '../../reports/period-history-types';

export const QUALITY_LABELS: Record<QualityBucket, string> = {
  need: 'Need',
  want: 'Want',
  regret: 'Regret',
  unrated: 'Unrated',
};

export function formatGroupAmount(amount: number): string {
  return formatVndCompact(amount);
}

export function formatExactAmount(amount: number): string {
  return formatVnd(amount);
}

export function formatQualityAmount(amount: number): string {
  return formatVnd(amount);
}

export function formatRegrettedLine(summary: MonthSummary): string {
  return `${formatVnd(summary.regrettedTotal)} regretted this month.`;
}

export function formatUnknownDrafts(count: number): string {
  return `${count} unknown ${count === 1 ? 'draft' : 'drafts'} excluded from these totals.`;
}

function paceSubject(history: PeriodHistory): string {
  if (history.reference.status !== 'available') return 'your usual pace';
  if (history.reference.label === 'usual') return 'your usual pace';
  if (history.reference.label === '2-period median') {
    return 'the two-period median';
  }
  return `${history.reference.label}'s pace`;
}

export function formatPaceCaption(history: PeriodHistory): string {
  if (history.reference.status === 'none') {
    return 'No previous month to compare yet.';
  }
  if (history.cutoffDay === 0 || history.gap === null) {
    return 'This period has not started yet.';
  }

  const subject = paceSubject(history);
  if (history.gap.relation === 'equal') {
    return `${formatVnd(history.gap.amount)} from ${subject} by day ${history.gap.day}.`;
  }
  return `${formatVnd(history.gap.amount)} ${history.gap.relation} ${subject} by day ${history.gap.day}.`;
}

export function formatPaceValue(amount: number): string {
  return formatVnd(amount);
}

export function qualitySegmentClass(quality: QualityBucket): string {
  switch (quality) {
    case 'need':
      return 'bg-need-light dark:bg-need-dark';
    case 'want':
      return 'bg-want-light dark:bg-want-dark';
    case 'regret':
      return 'bg-regret-light dark:bg-regret-dark';
    case 'unrated':
      return 'bg-faint-light dark:bg-faint-dark';
  }
}

export function qualityTextClass(quality: QualityBucket): string {
  switch (quality) {
    case 'need':
      return 'text-need-light dark:text-need-dark';
    case 'want':
      return 'text-want-light dark:text-want-dark';
    case 'regret':
      return 'text-regret-light dark:text-regret-dark';
    case 'unrated':
      return 'text-muted-light dark:text-muted-dark';
  }
}
