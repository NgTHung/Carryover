/**
 * Formats values already computed in a published snapshot for the home view.
 * Keeping this boundary free of arithmetic prevents presentation from becoming
 * a second budget engine.
 */
import { formatVnd } from '../../money/currency';
import type { BudgetSnapshot } from '../../budget/snapshot';

export function formatPerDay(snapshot: BudgetSnapshot): string {
  if (snapshot.perDay === null) {
    return 'Per day unavailable';
  }

  const estimate = snapshot.unloggedDrafts > 0 ? '~' : '';
  return `${estimate}${formatVnd(snapshot.perDay)}`;
}

export function formatCarryoverBalance(snapshot: BudgetSnapshot): string {
  return formatVnd(snapshot.balanceTotal);
}

export function formatDiscretionary(snapshot: BudgetSnapshot): string {
  return formatVnd(snapshot.discretionary);
}

export function formatReceivable(snapshot: BudgetSnapshot): string {
  return formatVnd(snapshot.owedToYou);
}

export function formatRunway(snapshot: BudgetSnapshot): string {
  if (snapshot.runwayDays === null) {
    return 'Runway unavailable';
  }

  const dayLabel = snapshot.runwayDays === 1 ? 'day' : 'days';
  return `${snapshot.runwayDays} ${dayLabel} runway`;
}

export function formatUnknownDrafts(snapshot: BudgetSnapshot): string {
  const draftLabel = snapshot.unloggedDrafts === 1 ? 'draft' : 'drafts';
  return `${snapshot.unloggedDrafts} unlogged ${draftLabel}`;
}

export function homeAccessibilityLabel(snapshot: BudgetSnapshot): string {
  const perDay = snapshot.perDay === null
    ? 'Per day unavailable'
    : `${snapshot.unloggedDrafts > 0 ? 'Approximately ' : ''}${formatVnd(snapshot.perDay)} per day`;
  const unknowns = snapshot.unloggedDrafts === 1
    ? '1 unlogged draft'
    : `${snapshot.unloggedDrafts} unlogged drafts`;
  return `${perDay}. ${unknowns}.`;
}
