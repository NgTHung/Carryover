---
id: "UI-021"
title: "Manage commitments and record reserve payments"
status: In Progress
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["app:DATA-006", "app:UI-020"]
last_updated: 2026-09-15
---

## Summary

Expose the existing commitment data API so you can reserve known commitments and record what you paid.

## Acceptance Criteria

- [x] Settings lets you list, create, edit, deactivate, and soft-delete commitments with an amount, due day, and reserve leaf.
- [x] You can see unpaid reserves for the selected period and record a payment as an ordinary expense through the shared creation flow, including its rejection of dates after today. A future reserve due date is not a recorded payment.
- [x] Payment matching reuses the existing deterministic rules; changing commitments does not rewrite historical month config snapshots. DATA-015 opens the period; this screen never invents missing config or treats a reserve payment as income.
- [x] Database and component tests cover validation, payment and deletion effects, duplicate reserve categories, and snapshot refresh.

## Verification

- Local candidate: `78a7a766d4d442a21ff38703baf2c06d8e85f8cd`.
- `npm test -- --runInBand` passed 65 suites and 344 tests.
- `npm run typecheck`, `npm run web:export`, and `npx expo export --platform ios` passed.
- `python3 -m unittest discover -s tests -p '*_test.py'` passed 12 tests.
- `git diff --check` and `taskroot validate` passed.
- Unsigned IPA CI and physical iPhone verification are pending. Keep this task In Progress until both are recorded.
