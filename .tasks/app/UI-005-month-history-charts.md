---
id: "UI-005"
title: "Month history charts"
status: Done
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["UI-004"]
risk: "Medium"
impact: "The pace line is the first month-over-month comparison the app can make without becoming a trend chart, and the calendar is the first screen that shows a day you spent nothing."
tags: ["ui", "reports", "charts"]
last_updated: 2026-09-13
---

## Summary

The second wave of the month summary, specified in docs/DESIGN.md section 8. Two charts that read a period day by day rather than by category.

A cumulative spend line from day 1 to today, drawn against the median of previous complete periods at the same day of month. Cumulative because the question is an accumulation and bars would make you integrate them by eye. A median staircase rather than a straight line to last month's total, because rent lands on one day and income clusters, so a straight line would claim day 15 sits at half the month.

A calendar grid, one cell per day, tinted from the four-step spend ramp in section 3. The tint bins against per day rather than the month's own maximum, so a calm month looks calm and two months stay comparable.

This is a separate task from UI-004 because it needs a different query shape. UI-004 aggregates a period by group; both charts here aggregate it by day, and building them together writes that query once.

It stays in stage 2 with the rest of the summary screen. The calendar is useful on day one. The pace line has nothing to draw until a period has completed, so its empty state is specified rather than left to chance, and rendering that state honestly is an acceptance criterion.

## Execution Notes

Split this work into four child tasks so the pure report model, the SQLite read shape, and the two chart surfaces remain reviewable. UI-015 owns integer-only day aggregation and historical reference points. UI-016 loads the selected period and complete stored reference periods from one consistent SQLite view. UI-017 renders the cumulative pace line and its optional scrubber. UI-018 renders the day calendar and in-place transaction details.

The selected period uses today as its cutoff when it is current, the period end when it is complete, and no actual points when it is in the future. A previous period is a reference only when it has a stored month_config and ended before today. A shorter reference period carries its final cumulative total through later day numbers so the median remains a cumulative staircase. Even reference samples use bigint midpoint division with a floor; no money value becomes a float. One reference is labelled with its period name, two with `2-period median`, and three or more with `usual`.

The calendar threshold comes from the stored period configuration, not current settings. Route the stored baseline of opening balance plus income minus reserves through the single budget engine, using the stored horizon distance from the period start. Spend-ramp comparisons use integer multiplication. A null or nonpositive threshold puts positive spending in the highest step; zero stays untinted.

Policy revision, 2026-09-13: DATA-015 will let the current period's stored income total follow actual income, so that period's calendar threshold can change. Past configuration money totals stay frozen, while actual historical transaction corrections remain visible. The calendar does not replay previously published daily snapshots. DATA-015 owns regression coverage for this change; the verification below records the original implementation.

Known-amount drafts count as spending. Unknown drafts stay explicit and never become zero. Both charts count your own split shares only. Income is a calendar corner mark. Transfers, adjustments, and settlements are absent from chart totals and expanded day details. The summary order is group, quality and regretted sentence, cumulative pace, then calendar. No streak, best-day, reward, arrow, or congratulatory copy is permitted.

## Acceptance Criteria

- [x] The cumulative line renders spend from day 1 to today and stops at today, never extended forward.
- [x] The reference line is the median of previous complete periods at the same day of month, not a straight line to a total.
- [x] With no complete previous period there is no reference line and the caption says so; with exactly one it is labelled with that month's name rather than usual.
- [x] The caption states the gap in dong flatly, with no arrow, no color, and no congratulation for being under.
- [x] The calendar tints each day from the section 3 spend ramp, binned against per day rather than the month maximum.
- [x] Zero-spend days are untinted, future days are outlines, and the two are visibly different.
- [x] Income renders as a corner mark and never as a second tint competing with spend on the same cell.
- [x] Every cell shows its day number, expands that day's transactions on tap, and reads as a sentence under VoiceOver.
- [x] No streak count, longest run, best day, or reward for a blank cell appears anywhere on the screen.
- [x] Both charts count your own split shares only, and no transfer or adjustment appears in either.

## Verification

- `npm run test:logic -- --runInBand` passed 24 suites and 95 tests.
- `npm run test:database -- --runInBand` passed 15 suites and 77 tests.
- `npm run test:component -- --runInBand` passed 12 suites and 71 tests.
- `npm test -- --runInBand` passed all 51 suites and 243 tests.
- `npm run typecheck` passed.
- `npm run web:export` passed.
- `npx expo export --platform ios` passed the iOS JavaScript bundle export.
- `npm ls react-native-svg --depth=0` reports `react-native-svg@15.15.4`.
- `taskroot validate` passed with 46 tasks and no warnings.

The report keeps period configuration and history in one committed SQLite read, computes daily money with BigInt and the shared budget engine, and renders the pace chart followed by the day calendar. Current periods stop at the injected cutoff, references are complete stored periods only, short references carry their final cumulative amount, and all captions and accessibility labels use exact integer VND. The calendar exposes own-share expense rows, income rows, and unknown drafts while omitting transfers, adjustments, settlements, and future transactions.
