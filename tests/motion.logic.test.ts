import { getMotionPlan, motionDurations } from '../src/ui/motion-plan';

test('normal motion uses the design durations', () => {
  expect(getMotionPlan('qualityChip', false)).toEqual({ kind: 'timing', duration: 120 });
  expect(getMotionPlan('draftCompleted', false)).toEqual({ kind: 'timing', duration: 500 });
  expect(motionDurations.reconcile).toBe(600);
});

test('reduced motion is instant except for the hero cross-fade', () => {
  expect(getMotionPlan('qualityChip', true)).toEqual({ kind: 'instant', duration: 0 });
  expect(getMotionPlan('captureSaved', true)).toEqual({ kind: 'instant', duration: 0 });
  expect(getMotionPlan('heroRecount', true)).toEqual({ kind: 'crossFade', duration: 150 });
});
