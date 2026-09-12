---
id: "UI-015"
title: "Compute period day history"
status: In Progress
priority: "High"
type: "Feature"
parent: "UI-005"
milestone: "0.3.0"
depends_on: ["UI-004"]
risk: "High"
impact: "Owns integer-only day aggregation, historical pace references, and calendar classification for the period charts."
tags: ["reports", "charts"]
last_updated: 2026-09-12
---

## Summary

Add the pure day-history report model used by the period pace line and calendar.

## Acceptance Criteria

- [x] The pure model returns one day record for every calendar day with known own spending, income, unknown drafts, and stable transaction detail.
- [x] Cumulative spending stops at today for the current period, at period end for completed periods, and has no future points.
- [x] Reference points use complete stored periods at the same calendar day, with deterministic integer median handling and explicit no-reference and one-reference states.
- [x] Spend-ramp steps use the stored period per-day threshold with integer comparisons, and transfers, adjustments, and other people's split shares are excluded.

## Verification

- `npm run test:logic -- --runInBand` passed 23 suites and 93 tests.
- `npm run typecheck` passed.
- The pure history model keeps money in BigInt through aggregation, reuses `computeBudget` for the frozen per-day threshold, and returns deterministic day, point, reference, and gap data.
