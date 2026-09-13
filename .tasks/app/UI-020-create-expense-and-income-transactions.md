---
id: "UI-020"
title: "Create expense and income transactions"
status: "To Do"
priority: "High"
type: "Feature"
milestone: "0.3.0"
depends_on: ["app:DATA-004", "app:UI-001"]
last_updated: "2026-09-13"
---

## Summary

You need to record money without a photo. Add creation routes using the existing transaction boundary and shared editor controls.

## Acceptance Criteria

- [ ] You can create an expense with a positive integer VND amount and a leaf, or income with an amount and optional source label; bank is the default.
- [ ] Date, account, quality, and note remain optional where the domain allows them. Cancel writes nothing; failed writes retain your input and repeated taps do not duplicate transactions.
- [ ] Saved transactions appear in the list and publish through the existing snapshot path; income updates the stored period through the existing month config policy.
- [ ] Database and component tests cover creation, invalid money, cancellation, restart persistence, and snapshot refresh.
