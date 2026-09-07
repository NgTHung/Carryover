---
id: "UI-005"
title: "Month history charts"
status: "To Do"
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["UI-004"]
risk: "Medium"
impact: "The pace line is the first month-over-month comparison the app can make without becoming a trend chart, and the calendar is the first screen that shows a day you spent nothing."
tags: ["ui", "reports", "charts"]
last_updated: "2026-09-06"
---

## Summary

The second wave of the month summary, specified in docs/DESIGN.md section 8. Two charts that read a period day by day rather than by category.

A cumulative spend line from day 1 to today, drawn against the median of previous complete periods at the same day of month. Cumulative because the question is an accumulation and bars would make you integrate them by eye. A median staircase rather than a straight line to last month's total, because rent lands on one day and income clusters, so a straight line would claim day 15 sits at half the month.

A calendar grid, one cell per day, tinted from the four-step spend ramp in section 3. The tint bins against per day rather than the month's own maximum, so a calm month looks calm and two months stay comparable.

This is a separate task from UI-004 because it needs a different query shape. UI-004 aggregates a period by group; both charts here aggregate it by day, and building them together writes that query once.

It stays in stage 2 with the rest of the summary screen. The calendar is useful on day one. The pace line has nothing to draw until a period has completed, so its empty state is specified rather than left to chance, and rendering that state honestly is an acceptance criterion.

## Acceptance Criteria

- [ ] The cumulative line renders spend from day 1 to today and stops at today, never extended forward.
- [ ] The reference line is the median of previous complete periods at the same day of month, not a straight line to a total.
- [ ] With no complete previous period there is no reference line and the caption says so; with exactly one it is labelled with that month's name rather than usual.
- [ ] The caption states the gap in dong flatly, with no arrow, no color, and no congratulation for being under.
- [ ] The calendar tints each day from the section 3 spend ramp, binned against per day rather than the month maximum.
- [ ] Zero-spend days are untinted, future days are outlines, and the two are visibly different.
- [ ] Income renders as a corner mark and never as a second tint competing with spend on the same cell.
- [ ] Every cell shows its day number, expands that day's transactions on tap, and reads as a sentence under VoiceOver.
- [ ] No streak count, longest run, best day, or reward for a blank cell appears anywhere on the screen.
- [ ] Both charts count your own split shares only, and no transfer or adjustment appears in either.
