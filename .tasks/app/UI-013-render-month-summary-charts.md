---
id: "UI-013"
title: "Render month summary charts"
status: Done
priority: "Medium"
type: "Feature"
parent: "UI-004"
milestone: "0.3.0"
depends_on: ["UI-012", "UI-001", "UI-007"]
risk: "Medium"
impact: "The report surface makes group comparisons and the quality axis useful without introducing chart dependencies or money arithmetic in UI code."
tags: ["reports", "ui"]
last_updated: 2026-09-12
---

## Summary

Add the native and browser summary routes, reuse the selected-period store, and render the ranked group and stacked quality views from the period report.

## Acceptance Criteria

- [x] The summary route loads, retries, and refreshes the selected period without substituting zero for loading, missing config, or errors.
- [x] Home navigation and the browser fixture reach the summary without opening SQLite on web.
- [x] Groups render as ranked horizontal bars with expandable leaves, exact accessible values, and stable ordering.
- [x] Quality renders need, want, regret, and unrated with palette tokens, 2px gaps, direct labels above 15 percent, and a persistent legend.
- [x] The regretted total, unknown-draft notice, period control, and accessibility states render from the report result.
- [x] Component, router, and existing transaction-filter tests cover navigation, period sharing, reloads, empty states, and chart interactions.

## Verification

- `npm run test:logic -- --runInBand` passed 22 suites and 87 tests.
- `npm run test:database -- --runInBand` passed 15 suites and 76 tests.
- `npm run test:component -- --runInBand` passed 11 suites and 66 tests.
- `npm run typecheck` passed.
- `npm run web:export` passed, confirming the browser summary fixture bundles without SQLite access.
- The summary route uses the UI-001 period store and a stable native data boundary. Group bar flex weights and quality label thresholds come from the pure report result, so UI code performs no money arithmetic.
