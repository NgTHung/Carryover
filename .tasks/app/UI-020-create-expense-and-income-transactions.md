---
id: "UI-020"
title: "Create expense and income transactions"
status: In Progress
priority: "High"
type: "Feature"
milestone: "0.3.0"
depends_on: ["app:DATA-004", "app:UI-001", "app:DATA-015"]
last_updated: 2026-09-14
---

## Summary

You need to record money without a photo. Add creation routes using the existing transaction boundary and shared editor controls.

Follow docs/spec/period-income-policy.md. DATA-015 supplies period opening and atomic current-period income maintenance before this task starts. Income requires no fixed amount or arrival date and never moves the horizon automatically. Use one creation route with a validated direction parameter; keep screen loading and navigation in src/app and shared form controls in src/ui.

## Acceptance Criteria

- [x] You can create a complete expense with a positive integer VND amount and an active leaf, or income with an amount and optional source label and no category. Bank and the current local date are defaults; quality and note remain optional. Payer defaults to you, photo is null, and neither leaf nor quality is preselected.
- [x] Manual expense and income create, edit, and draft completion reject dates after today at the write boundary and show field feedback using the local calendar. A future horizon remains valid under its existing rules.
- [x] Cancel before submission writes nothing and preserves list filters. Navigation away and Cancel are disabled during a write; failed writes retain every input and repeated taps do not duplicate transactions.
- [x] Creation reuses editor controls without changing blank draft amounts from null, overwriting hidden photo or payer fields, or losing unchanged historical category references. Invalid direction links stop before ledger reads; browser routes never open the ledger.
- [x] Expense and income actions remain reachable in an empty list. After creation, the list selects the saved transaction's period and clears filters so the row is visible; existing notifications refresh the list and reports.
- [x] Income uses DATA-015 to update actual current-period income atomically with the ledger. Past stored money totals and every horizon remain unchanged. Snapshot publication uses the existing path without screen arithmetic or a second refresh service.
- [x] A snapshot or navigation failure after commit leaves one saved transaction. Publication retry reads committed data without repeating the insert or counting income again.
- [ ] Logic, real SQLite, component, and route tests cover creation, invalid money and dates, cancellation, duplicate taps, failed writes, file-backed restart persistence, current and historical income effects, and snapshot refresh. The iPhone check records keyboard access, safe areas, larger text, and saved figures.

## Verification

- Candidate revision: `80b3b68`.
- `npm test -- --runInBand`: 59 suites and 300 tests passed.
- `npm run typecheck`: passed.
- `npm run web:export`: passed, including the browser creation fallback.
- `npx expo export --platform ios`: passed, producing the iOS JavaScript bundle.
- `python3 -m unittest discover -s tests -p '*_test.py'`: 12 tests passed.
- `git diff --check`: passed.
- `taskroot validate`: passed with 85 tasks and 0 warnings.
- Physical iPhone and CI native-build evidence is pending. This workspace has no Mac, iPhone, or authorized CI push, so keyboard, safe-area, larger-text, restart, and device snapshot checks were not performed.
