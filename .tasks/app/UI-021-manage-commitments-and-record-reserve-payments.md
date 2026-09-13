---
id: "UI-021"
title: "Manage commitments and record reserve payments"
status: "To Do"
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["app:DATA-006", "app:UI-020"]
last_updated: "2026-09-13"
---

## Summary

Expose the existing commitment data API so you can reserve known commitments and record what you paid.

## Acceptance Criteria

- [ ] Settings lets you list, create, edit, deactivate, and soft-delete commitments with an amount, due day, and reserve leaf.
- [ ] You can see unpaid reserves for the selected period and record a payment as an ordinary expense through the shared creation flow.
- [ ] Payment matching reuses the existing deterministic rules; changing commitments does not rewrite historical month config snapshots.
- [ ] Database and component tests cover validation, payment and deletion effects, duplicate reserve categories, and snapshot refresh.
