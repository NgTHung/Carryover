/** Validate the selected commitment period before any ledger read. */
import { currentPeriod, periodSchema, type Period } from '../../data/period';

export type ParsedCommitmentRoute =
  | { status: 'valid'; period: Period; defaulted: boolean }
  | { status: 'invalid'; message: string };

export function parseCommitmentRoute(
  value: unknown,
  now: Date = new Date()
): ParsedCommitmentRoute {
  if (value === undefined) {
    return { status: 'valid', period: currentPeriod(now), defaulted: true };
  }
  const parsed = periodSchema.safeParse(value);
  return parsed.success
    ? { status: 'valid', period: parsed.data as Period, defaulted: false }
    : { status: 'invalid', message: 'This commitment period link is invalid.' };
}
