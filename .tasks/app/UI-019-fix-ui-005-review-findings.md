---
id: "UI-019"
title: "Fix UI-005 review findings"
status: Done
priority: "High"
type: "Bug"
milestone: "0.3.0"
depends_on: ["UI-005"]
risk: "Medium"
impact: "Incorrect scrub coordinates can report the wrong day, hidden endpoint values weaken the chart without touch, and unknown drafts can look like zero-spend days."
tags: ["ui", "reports", "charts"]
last_updated: 2026-09-12
---

## Summary

Correct the cumulative pace interaction and make exact endpoint values and unknown calendar drafts visible without relying on a gesture or VoiceOver.

## Acceptance Criteria

- [x] Scrubbing maps the full period chart geometry to the matching elapsed day and clamps future positions to the cutoff.
- [x] The chart exposes exact current and reference values without requiring the scrub gesture, including in its accessibility label.
- [x] Calendar cells with unknown drafts have a visible non-color marker and the legend explains it.

## Verification

- `npm run test:logic -- --runInBand tests/pace-chart.logic.test.ts` passed 1 suite and 2 tests.
- `npm run test:component -- --runInBand tests/month-summary.component.test.tsx tests/day-calendar.component.test.tsx` passed 2 suites and 10 tests.
- `npm test -- --runInBand` passed all 51 suites and 243 tests.
- `npm run typecheck` passed.
- `npm run web:export` passed.
- `npx expo export --platform ios` passed the iOS JavaScript bundle export.
- `git diff --check` passed.

Scrub coordinates now use the full period width before they clamp to the selected cutoff. The chart keeps exact cutoff values visible at rest and includes them in its accessibility label. An unknown draft renders as a question-mark corner marker with a matching legend entry, while known spending still controls the tint.
