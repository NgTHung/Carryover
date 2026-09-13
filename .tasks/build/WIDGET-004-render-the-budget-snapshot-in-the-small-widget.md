---
id: "WIDGET-004"
title: "Render the budget snapshot in the small widget"
status: "To Do"
priority: "Medium"
type: "Feature"
parent: "build:WIDGET-002"
milestone: "0.7.0"
depends_on: ["build:WIDGET-003", "app:BUDGET-002"]
last_updated: "2026-09-13"
---

## Summary

Use the proven shared-storage path to render the same artifact as Home in the separate widget runtime.

## Acceptance Criteria

- [ ] The small widget renders per day and the unknown badge from the snapshot, and shows runway when it is below days to horizon.
- [ ] Missing, invalid, stale, or unavailable snapshot figures have explicit states and never display an invented zero.
- [ ] The widget performs no budget arithmetic or database reads and imports no app routing, Zustand, NativeWind, or Reanimated runtime.
- [ ] Fixture tests cover ready and unavailable snapshots and the runway switch; the iPhone check compares widget values to Home.
