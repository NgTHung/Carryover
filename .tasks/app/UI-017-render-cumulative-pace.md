---
id: "UI-017"
title: "Render cumulative pace"
status: "To Do"
priority: "Medium"
type: "Feature"
parent: "UI-005"
milestone: "0.3.0"
depends_on: ["UI-016", "UI-007"]
risk: "Medium"
impact: "Makes the selected period's actual accumulation and historical reference readable without introducing forecast math or a chart dependency that can drift from report data."
tags: ["reports", "charts"]
last_updated: "2026-09-12"
---

## Summary

Render the cumulative spend line, reference staircase, neutral gap caption, and optional day scrubber from the pure period history result.

## Acceptance Criteria

- [ ] The actual line stops at the selected cutoff, the reference line uses its direct label and dashed muted styling, and no forecast is drawn.
- [ ] No-reference, one-reference, two-reference, and usual-reference captions remain explicit and flat, with no color or congratulation.
- [ ] Scrubbing reads both integer values for a day while end labels and the caption remain sufficient without the gesture.
- [ ] Component and geometry tests cover cutoff points, labels, gap direction, and accessibility.
