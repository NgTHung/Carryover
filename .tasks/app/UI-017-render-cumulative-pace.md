---
id: "UI-017"
title: "Render cumulative pace"
status: In Progress
priority: "Medium"
type: "Feature"
parent: "UI-005"
milestone: "0.3.0"
depends_on: ["UI-016", "UI-007"]
risk: "Medium"
impact: "Makes the selected period's actual accumulation and historical reference readable without introducing forecast math or a chart dependency that can drift from report data."
tags: ["reports", "charts"]
last_updated: 2026-09-12
---

## Summary

Render the cumulative spend line, reference staircase, neutral gap caption, and optional day scrubber from the pure period history result.

## Acceptance Criteria

- [x] The actual line stops at the selected cutoff, the reference line uses its direct label and dashed muted styling, and no forecast is drawn.
- [x] No-reference, one-reference, two-reference, and usual-reference captions remain explicit and flat, with no color or congratulation.
- [x] Scrubbing reads both integer values for a day while end labels and the caption remain sufficient without the gesture.
- [x] Component and geometry tests cover cutoff points, labels, gap direction, and accessibility.

## Verification

- `npm run test:logic -- --runInBand` passed 24 suites and 95 tests.
- `npm run test:component -- --runInBand` passed 11 suites and 69 tests.
- `npm run typecheck` passed.
- `react-native-svg` is pinned to the Expo SDK 57 compatible `15.15.4` release.
