---
id: "MILESTONE-003"
title: "One honest daily figure"
status: To Do
priority: "High"
type: "Milestone"
milestone: "0.3.0"
last_updated: 2026-09-02
---

## Summary

Stage 2. The budget engine, the home screen, commitments, reconcile, and the month summary. This is the stage with a correct answer, so it is the stage that gets tested hardest.

Daily use starts here. Real data changes the category list before anything is built on top of it, so the capture stage waits until the numbers have been lived with.

## Exit Criteria

- [ ] `computeBudget` is a pure function and no component, hook, screen, or widget computes a budget figure of its own.
- [ ] The home screen renders per day, discretionary, and runway from the snapshot.
- [ ] Commitments produce unpaid reserves and paying one is a normal logged transaction.
- [ ] Reconcile writes a visible adjustment that no report counts.
- [ ] `month_config` is written per period and read back from storage, never recomputed.
- [ ] The app is installed on the phone and in daily use.
