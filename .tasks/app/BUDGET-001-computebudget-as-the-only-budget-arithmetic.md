---
id: "BUDGET-001"
title: "computeBudget as the only budget arithmetic"
status: To Do
priority: "High"
type: "Feature"
milestone: "0.3.0"
depends_on: ["DATA-004", "DATA-005", "DATA-006"]
risk: "High"
impact: "The single most important structural decision in the codebase. A second implementation anywhere means the home screen and the widget can disagree, and the one on the home screen is the one you would believe."
tags: ["budget", "engine", "invariant"]
last_updated: 2026-09-02
---

## Summary

One pure function from `BudgetInput` to the `BudgetSnapshot` already declared in `src/budget/snapshot.ts`. Nothing else in the app computes a budget number, not a component, not a hook, not the widget. The widget runs in a separate JavaScript runtime with no database and no app state, so a second implementation would drift and the two surfaces would disagree.

Discretionary is the carryover balance minus unpaid reserves. Per day is discretionary divided by days to horizon. Runway is discretionary divided by the thirty day average burn. All three are integer arithmetic, and both divisors can be zero on a real day.

Spending counts your own split share only. Settlements, transfers, and adjustments move neither spending nor income. Drafts with no amount are reported as a count of unknowns and never as zero, which is what stops the figure being optimistic exactly when you have been too busy to log.

## Acceptance Criteria

- [ ] `computeBudget(input: BudgetInput): BudgetSnapshot` is pure, with no database, clock, or filesystem access inside it.
- [ ] No component, hook, screen, or widget computes a budget figure. Budget arithmetic appears in one module.
- [ ] Every intermediate value is an integer. Rounding is deterministic and documented where it happens.
- [ ] Spending counts your own share of a split, never the full transaction amount.
- [ ] Settlements, transfers, and adjustments are excluded from spending and income.
- [ ] Unknown drafts are returned as `unloggedDrafts` and are never treated as zero.
- [ ] `tests/` covers a zero-day horizon, a zero burn rate, negative discretionary, a period with no transactions, and a split where your share is not half.
- [ ] `tests/` asserts the same input produces the same snapshot on repeated runs.
