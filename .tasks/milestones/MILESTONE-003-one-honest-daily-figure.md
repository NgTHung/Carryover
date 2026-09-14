---
id: "MILESTONE-003"
title: "One honest daily figure"
status: To Do
priority: "High"
type: "Milestone"
milestone: "0.3.0"
last_updated: 2026-09-13
---

## Summary

Stage 2. The budget engine, the home screen, commitments, reconcile, and the month summary. This is the stage with a correct answer, so it is the stage that gets tested hardest.

Daily use starts here and informs the later UI overhaul. UI-020 through UI-024 complete the missing controls for transaction creation, commitments, the horizon, transfers, and account details. Capture development does not wait for a fixed period of daily use.

DATA-015 precedes UI-020, UI-022, and UI-024. It opens periods without requiring a fixed income or payday, maintains actual current-period income, and preserves past money totals. The contract is docs/spec/period-income-policy.md.

## Exit Criteria

- [ ] `computeBudget` is a pure function and no component, hook, screen, or widget computes a budget figure of its own.
- [ ] The home screen renders per day, discretionary, and runway from the snapshot.
- [ ] Commitments produce unpaid reserves and paying one is a normal logged transaction.
- [ ] Reconcile writes a visible adjustment that no report counts.
- [ ] DATA-015 opens the current period on first launch and rollover. Current income totals track actual ledger events atomically; past configuration money totals stay frozen and reports read stored configuration.
- [ ] Manual expense and income dates after today are rejected. Receiving income changes current figures without changing the stored horizon or inventing an expected payday.
- [ ] The month summary renders spend by group, the quality breakdown, and the day calendar.
- [ ] The app is installed on the phone and in daily use.
- [ ] UI-020 through UI-024 make the existing ledger operations usable from the app, with money and snapshot behavior covered by tests.
- [ ] Fast tests and the native build pass for the candidate revision. Startup, navigation, transaction editing, restart persistence, and the home snapshot are checked on the iPhone.
