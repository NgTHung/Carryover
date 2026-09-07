---
id: "UI-001"
title: "Transaction list with filters"
status: To Do
priority: "Medium"
type: "Feature"
milestone: "0.2.0"
depends_on: ["DATA-004", "UI-006", "UI-007"]
risk: "Low"
impact: "The only way to see whether the ledger is right before the budget engine exists."
tags: ["ui", "transactions"]
last_updated: 2026-09-07
---

## Summary

A list of transactions with filters by period, category, account, and quality. This is the screen that proves stage 1 works, because until the engine lands there is no other view of what was stored.

Adjustments and transfers appear here even though no report counts them. Drift stays honest only if you can see it.

Introduce Zustand for the selected period and transaction filters shared across screens. Components subscribe with selectors. SQLite supplies the transaction rows through the data layer, and screen-local input stays in React state. Follow `docs/state-and-validation.md`.

## Acceptance Criteria

- [ ] The list shows amount, leaf category, account, quality, and date for each transaction.
- [ ] Filters by period, category, account, and quality combine rather than replace each other.
- [ ] Zustand owns the shared selected period and filters, retains them across screen navigation, and supports an explicit reset. It stores no transaction collection or computed money totals.
- [ ] The list refreshes after committed creates, edits, completions, and soft deletes, including writes from another screen.
- [ ] Adjustments and transfers are visible and visually distinct from spending.
- [ ] Drafts appear with their unknown amount shown as unknown, not as zero.
- [ ] Tapping a transaction opens it for editing.
- [ ] Expo Router opens a transaction by id, and the screen loads it through the public data API. A missing or deleted transaction has an explicit unavailable state.
- [ ] The screen reuses UI-007 primitives. React Native Testing Library covers combined filters, unknown amounts, and opening a transaction without a native build.
