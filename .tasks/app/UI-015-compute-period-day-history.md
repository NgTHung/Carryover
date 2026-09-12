---
id: "UI-015"
title: "Compute period day history"
status: "To Do"
priority: "High"
type: "Feature"
parent: "UI-005"
milestone: "0.3.0"
depends_on: ["UI-004"]
risk: "High"
impact: "Owns integer-only day aggregation, historical pace references, and calendar classification for the period charts."
tags: ["reports", "charts"]
last_updated: "2026-09-12"
---

## Summary

Add the pure day-history report model used by the period pace line and calendar.

## Acceptance Criteria

- [ ] The pure model returns one day record for every calendar day with known own spending, income, unknown drafts, and stable transaction detail.
- [ ] Cumulative spending stops at today for the current period, at period end for completed periods, and has no future points.
- [ ] Reference points use complete stored periods at the same calendar day, with deterministic integer median handling and explicit no-reference and one-reference states.
- [ ] Spend-ramp steps use the stored period per-day threshold with integer comparisons, and transfers, adjustments, and other people's split shares are excluded.
