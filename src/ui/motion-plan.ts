/**
 * Pure motion policy for the design's named moments.
 *
 * Reduced motion removes movement everywhere except the hero recount, where a
 * short cross-fade keeps the change visible without interpolating an amount.
 */
export const motionDurations = {
  appOpen: 320,
  captureSaved: 400,
  draftCompleted: 500,
  reconcile: 600,
  qualityChip: 120,
  crossFade: 200,
  heroRecount: 500,
} as const;

export type MotionIntent = keyof typeof motionDurations;

export type MotionPlan =
  | { kind: 'instant'; duration: 0 }
  | { kind: 'timing'; duration: number }
  | { kind: 'crossFade'; duration: 150 };

export function getMotionPlan(intent: MotionIntent, reducedMotion: boolean): MotionPlan {
  if (!reducedMotion) {
    return { kind: 'timing', duration: motionDurations[intent] };
  }

  if (intent === 'heroRecount') {
    return { kind: 'crossFade', duration: 150 };
  }

  return { kind: 'instant', duration: 0 };
}
