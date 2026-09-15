/** Validate the period selected by a horizon editor route before any read. */
import { currentPeriod, periodSchema, type Period } from '../../data/period';

export type ParsedHorizonRoute =
  | { status: 'valid'; period: Period; defaulted: boolean }
  | { status: 'invalid'; message: string };

export function parseHorizonRoute(
  value: unknown,
  now: Date = new Date()
): ParsedHorizonRoute {
  if (value === undefined) {
    return { status: 'valid', period: currentPeriod(now), defaulted: true };
  }

  const parsed = periodSchema.safeParse(value);
  return parsed.success
    ? { status: 'valid', period: parsed.data as Period, defaulted: false }
    : { status: 'invalid', message: 'This horizon period link is invalid.' };
}
