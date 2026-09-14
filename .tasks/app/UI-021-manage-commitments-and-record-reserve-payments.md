---
id: "UI-021"
title: "Manage commitments and record reserve payments"
status: In Progress
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["app:DATA-006", "app:UI-020"]
last_updated: 2026-09-14
---

## Summary

Expose the existing commitment data API so you can reserve known commitments and record what you paid.

## Acceptance Criteria

- [ ] Settings lets you list, create, edit, deactivate, and soft-delete commitments with an amount, due day, and reserve leaf.
- [ ] You can see unpaid reserves for the selected period and record a payment as an ordinary expense through the shared creation flow, including its rejection of dates after today. A future reserve due date is not a recorded payment.
- [ ] Payment matching reuses the existing deterministic rules; changing commitments does not rewrite historical month config snapshots. DATA-015 opens the period; this screen never invents missing config or treats a reserve payment as income.
- [ ] Database and component tests cover validation, payment and deletion effects, duplicate reserve categories, and snapshot refresh.
