---
id: "UI-001"
title: "Transaction list with filters"
status: To Do
priority: "Medium"
type: "Feature"
milestone: "0.2.0"
depends_on: ["DATA-004"]
risk: "Low"
impact: "The only way to see whether the ledger is right before the budget engine exists."
tags: ["ui", "transactions"]
last_updated: 2026-09-02
---

## Summary

A list of transactions with filters by period, category, account, and quality. This is the screen that proves stage 1 works, because until the engine lands there is no other view of what was stored.

Adjustments and transfers appear here even though no report counts them. Drift stays honest only if you can see it.

## Acceptance Criteria

- [ ] The list shows amount, leaf category, account, quality, and date for each transaction.
- [ ] Filters by period, category, account, and quality combine rather than replace each other.
- [ ] Adjustments and transfers are visible and visually distinct from spending.
- [ ] Drafts appear with their unknown amount shown as unknown, not as zero.
- [ ] Tapping a transaction opens it for editing.
