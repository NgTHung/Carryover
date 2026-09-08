/**
 * Native probes used by the signing spike screen.
 *
 * Keeping the widget import here lets Metro replace the whole module on web.
 * The browser never evaluates iOS-only widget code.
 */
import { requireNativeModule } from 'expo-modules-core';

import { CarryoverWidget } from '../../widgets/CarryoverWidget';
import type { SigningFacts, WidgetPushResult } from './runtime-diagnostics.types';

export function readSigningFacts(): SigningFacts | string {
  try {
    const native = requireNativeModule('ExpoWidgets') as { signingFacts?: SigningFacts };
    if (!native.signingFacts) {
      return 'ExpoWidgets module has no signingFacts constant. The patch did not apply to this build.';
    }
    return native.signingFacts;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export async function pushFixtureToWidget(): Promise<WidgetPushResult> {
  CarryoverWidget.updateSnapshot({ perDay: 12_000, runwayDays: 7, unloggedDrafts: 0 });
  CarryoverWidget.reload();
  const timeline = await CarryoverWidget.getTimeline();
  return { status: 'pushed', timelineEntries: timeline.length };
}
