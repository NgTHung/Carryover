---
id: "UI-022"
title: "Change the stored horizon"
status: "To Do"
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["app:DATA-005", "app:UI-003", "app:DATA-015"]
last_updated: "2026-09-15"
---

## Summary

You choose how long your discretionary money should last, even when you do not know when income will arrive. Expose the existing month config operation without computing figures in the form. DATA-015 prepares the period first; receiving income never moves this date automatically.

## Execution Plan

Follow [the UI-022 execution plan](../../docs/plans/UI-022.md) for the editor contract, period rollover behavior, commit stages, and verification. Planning leaves this task To Do.

## Acceptance Criteria

- [ ] Home shows the stored horizon and opens a date editor that saves through the month config API.
- [ ] The editor enforces existing date and period rules, preserves input on failure, and leaves storage unchanged on cancellation. Future horizon dates, including dates beyond period end, remain valid; the transaction future-date restriction does not apply here.
- [ ] Saving refreshes the published snapshot; unrelated historical snapshots remain unchanged.
- [ ] Database and component tests cover valid changes, rejected dates, period boundaries, and per day read from the resulting snapshot.
