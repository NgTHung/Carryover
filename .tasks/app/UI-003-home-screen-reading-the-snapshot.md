---
id: "UI-003"
title: "Home screen reading the snapshot"
status: To Do
priority: "High"
type: "Feature"
milestone: "0.3.0"
depends_on: ["BUDGET-001"]
risk: "Medium"
impact: "The screen that decides whether the app gets trusted. If it computes anything itself it can disagree with the widget."
tags: ["ui", "budget"]
last_updated: 2026-09-02
---

## Summary

Per day is the large figure. The carryover balance and runway sit beneath it. The unknown badge shows when unfilled drafts exist, because a remaining figure with two unlogged purchases behind it is optimistic and should say so.

The screen renders snapshot fields. It does no arithmetic of its own, including no rounding and no division, so that what you read here is what the widget reads.

## Acceptance Criteria

- [ ] Per day is the largest figure on the screen.
- [ ] Carryover balance and runway render beneath it.
- [ ] The unknown badge shows the count of drafts with no amount and hides at zero.
- [ ] The receivable total shows beside discretionary when it is non-zero.
- [ ] The screen reads snapshot fields and performs no budget arithmetic.
- [ ] The capture button is present and reachable with one thumb.
