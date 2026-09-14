---
id: "UI-020"
title: "Create expense and income transactions"
status: "To Do"
priority: "High"
type: "Feature"
milestone: "0.3.0"
depends_on: ["app:DATA-004", "app:UI-001", "app:DATA-015"]
last_updated: "2026-09-13"
---

## Summary

You need to record money without a photo. Add creation routes using the existing transaction boundary and shared editor controls.

Follow docs/spec/period-income-policy.md and docs/plans/UI-020.md. DATA-015 supplies period opening and atomic current-period income maintenance before this task starts. Income requires no fixed amount or arrival date and never moves the horizon automatically. Use one creation route with a validated direction parameter; keep screen loading and navigation in src/app and shared form controls in src/ui.

## Acceptance Criteria

- [ ] You can create a complete expense with a positive integer VND amount and an active leaf, or income with an amount and optional source label and no category. Bank and the current local date are defaults; quality and note remain optional. Payer defaults to you, photo is null, and neither leaf nor quality is preselected.
- [ ] Manual expense and income create, edit, and draft completion reject dates after today at the write boundary and show field feedback using the local calendar. A future horizon remains valid under its existing rules.
- [ ] Cancel before submission writes nothing and preserves list filters. Navigation away and Cancel are disabled during a write; failed writes retain every input and repeated taps do not duplicate transactions.
- [ ] Creation reuses editor controls without changing blank draft amounts from null, overwriting hidden photo or payer fields, or losing unchanged historical category references. Invalid direction links stop before ledger reads; browser routes never open the ledger.
- [ ] Expense and income actions remain reachable in an empty list. After creation, the list selects the saved transaction's period and clears filters so the row is visible; existing notifications refresh the list and reports.
- [ ] Income uses DATA-015 to update actual current-period income atomically with the ledger. Past stored money totals and every horizon remain unchanged. Snapshot publication uses the existing path without screen arithmetic or a second refresh service.
- [ ] A snapshot or navigation failure after commit leaves one saved transaction. Publication retry reads committed data without repeating the insert or counting income again.
- [ ] Logic, real SQLite, component, and route tests cover creation, invalid money and dates, cancellation, duplicate taps, failed writes, file-backed restart persistence, current and historical income effects, and snapshot refresh. The iPhone check records keyboard access, safe areas, larger text, and saved figures.
