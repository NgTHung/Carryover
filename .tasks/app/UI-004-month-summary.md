---
id: "UI-004"
title: "Month summary"
status: Done
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["BUDGET-001", "DATA-005", "UI-001"]
risk: "High"
impact: "The only place the need, want, regret axis pays off. It also proves the stored month config is being read rather than recomputed, while sharing split interpretation with the budget snapshot."
tags: ["ui", "reports"]
last_updated: 2026-09-13
---

## Summary

Spend by group for a period, the need, want, and regret split, and the regretted total called out on its own. Reporting happens at the group because that is what two levels are for.

Past periods read their stored `month_config`. Historical transaction corrections can change actual report totals; they must not rewrite stored configuration money totals. DATA-015 adds current-period income maintenance and verifies that distinction under docs/spec/period-income-policy.md.

`docs/DESIGN.md` section 8 specifies both charts. Spend by group is ranked horizontal bars rather than a pie, because the comparison that matters is between quantities that sit close together. Quality is one stacked bar with 2px gaps and direct labels, which the palette section marks as mandatory rather than polish.

The two day-level charts in that section are UI-005. They wait because the pace line has nothing to draw until a period has completed.

## Execution Notes

Split this work into read-only money inputs, the pure period-summary report, and the route and charts so each change stays reviewable. The read path may support existing split rows, but SPLIT-001 still owns contacts, split writes, and settlements.

A known-amount draft without a leaf is reported under `No group yet` and `unrated`. A draft without an amount is an explicit unknown count and contributes no total. A period without a stored `month_config` is unavailable, never an empty zero-valued report. The quality bar includes a neutral `unrated` segment. The pace line and day calendar remain UI-005.

The route uses the UI-001 selected-period store. The report read returns the stored `month_config` and ledger rows from one SQLite view, and all money aggregation remains in pure code with integer VND and `bigint` intermediates.

## Acceptance Criteria

- [x] Spend by group for the selected period, counting your own shares only.
- [x] The need, want, and regret breakdown renders, with the regretted total called out.
- [x] Transfers and adjustments appear in no total on this screen.
- [x] Selecting a past period reads that period's stored `month_config`.
- [x] Period selection reuses the UI-001 Zustand store. Reports read stored ledger data for that period, and store selectors calculate no money totals.
- [x] Transactions with no quality set are counted in the group totals and shown as unrated.
- [x] Spend by group is ranked bars and the quality breakdown carries the gaps and direct labels required by `docs/DESIGN.md` section 3.

## Verification

- UI-004 shipped in three reviewable stages: DATA-010 shared own-share reads, UI-012 pure stored-period summaries, and UI-013 native/browser charts.
- `npm run test:logic -- --runInBand` passed 22 suites and 87 tests.
- `npm run test:database -- --runInBand` passed 15 suites and 76 tests.
- `npm run test:component -- --runInBand` passed 11 suites and 66 tests.
- `npm run typecheck` and `npm run web:export` passed.
- UI-005 remains responsible for day-level pace and calendar charts. SPLIT-001 remains responsible for split writes, contacts, and settlements.
