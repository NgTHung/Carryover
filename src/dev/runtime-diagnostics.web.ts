/**
 * Browser substitutes for probes that only exist in the signed iOS binary.
 */
import type { SigningFacts, WidgetPushResult } from './runtime-diagnostics.types';

export function readSigningFacts(): SigningFacts | string {
  return 'Signing facts are only available in an installed iOS build.';
}

export async function pushFixtureToWidget(): Promise<WidgetPushResult> {
  return {
    status: 'unavailable',
    reason: 'The widget is only available in an installed iOS build.',
  };
}
