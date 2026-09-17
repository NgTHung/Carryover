---
id: "CAPTURE-006"
title: "Nudge while unknown drafts exist"
status: Done
priority: "Medium"
type: "Feature"
parent: "app:CAPTURE-001"
milestone: "0.4.0"
depends_on: ["app:CAPTURE-005"]
last_updated: 2026-09-17
---

## Summary

Use one daily local notification to remind you about unknowns without requiring notification access to capture.

## Execution Plan

Follow [the CAPTURE-006 execution plan](../../docs/plans/CAPTURE-006.md) for contextual permission, unknown eligibility across periods, one daily schedule, duplicate and failure recovery, startup and foreground reconciliation, inbox navigation, staged commits, and iPhone verification.

CAPTURE-005 is Done. Reminder implementation and local verification are complete. The reminder runs at 20:00 local time and requests permission from Drafts. On 2026-09-17, you deferred iPhone verification until all features are implemented. Native delivery and navigation checks now belong to build:BUILD-005 and do not block this implementation task.

## Progress

See [the reminder verification record](../../docs/build/draft-nudge.md) for local results and pending device checks. A navigation recovery fix keeps a retained notification tap retryable across root remounts until Drafts is visible. Regression tests cover remount recovery and duplicate prevention when native response cleanup fails.

## Acceptance Criteria

- [x] Permission is requested in context and denial leaves capture and completion usable.
- [x] At most one daily nudge is scheduled while unknowns exist; completion or deletion of the last unknown cancels it.
- [x] Startup and foreground refresh reconcile notification state, and tapping the notification opens the draft inbox.
- [x] Adapter tests cover scheduling, cancellation, duplicates, and permission errors. The iPhone delivery and navigation checks are recorded under build:BUILD-005 for execution after feature implementation.

## Deferred verification

The iPhone matrix in docs/build/draft-nudge.md remains PENDING. Closing this task records the locally verified implementation and your decision to defer device checks. It does not claim a native build, notification delivery, or device navigation pass.
