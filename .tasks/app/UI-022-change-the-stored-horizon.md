---
id: "UI-022"
title: "Change the stored horizon"
status: Done
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["app:DATA-005", "app:UI-003", "app:DATA-015"]
last_updated: 2026-09-15
---

## Summary

You choose how long your discretionary money should last, even when you do not know when income will arrive. Expose the existing month config operation without computing figures in the form. DATA-015 prepares the period first; receiving income never moves this date automatically.

## Execution Plan

Follow [the UI-022 execution plan](../../docs/plans/UI-022.md) for the editor contract, period rollover behavior, commit stages, and verification. Planning leaves this task To Do.

## Acceptance Criteria

- [x] Home shows the stored horizon and opens a date editor that saves through the month config API.
- [x] The editor enforces existing date and period rules, preserves input on failure, and leaves storage unchanged on cancellation. Future horizon dates, including dates beyond period end, remain valid; the transaction future-date restriction does not apply here.
- [x] Saving refreshes the published snapshot; unrelated historical snapshots remain unchanged.
- [x] Database and component tests cover valid changes, rejected dates, period boundaries, and per day read from the resulting snapshot.

## Implementation Notes

- Added the typed horizon editor boundary, native and browser routes, shared date form, Home horizon row, and current-period navigation.
- Kept publication in the existing notifier and snapshot publisher. The editor does not compute or patch budget figures.
- Verified with `npm test -- --runInBand`: 70 suites passed, 370 tests passed.
- Verified with `npm run typecheck`.
- Verified with `npx expo export --platform web` and `npx expo export --platform ios`.
- Verified with `taskroot validate` and `git diff --check`.
- The iOS export verifies JavaScript bundling only. Outstanding native checks are the iPhone interaction checks and the authorized macOS CI candidate build listed in BUILD-005. Widget device verification remains with WIDGET-002.
