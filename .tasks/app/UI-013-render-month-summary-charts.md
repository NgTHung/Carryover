---
id: "UI-013"
title: "Render month summary charts"
status: "To Do"
priority: "Medium"
type: "Feature"
parent: "UI-004"
milestone: "0.3.0"
depends_on: ["UI-012", "UI-001", "UI-007"]
risk: "Medium"
impact: "The report surface makes group comparisons and the quality axis useful without introducing chart dependencies or money arithmetic in UI code."
tags: ["reports", "ui"]
last_updated: "2026-09-12"
---

## Summary

Add the native and browser summary routes, reuse the selected-period store, and render the ranked group and stacked quality views from the period report.

## Acceptance Criteria

- [ ] The summary route loads, retries, and refreshes the selected period without substituting zero for loading, missing config, or errors.
- [ ] Home navigation and the browser fixture reach the summary without opening SQLite on web.
- [ ] Groups render as ranked horizontal bars with expandable leaves, exact accessible values, and stable ordering.
- [ ] Quality renders need, want, regret, and unrated with palette tokens, 2px gaps, direct labels above 15 percent, and a persistent legend.
- [ ] The regretted total, unknown-draft notice, period control, and accessibility states render from the report result.
- [ ] Component, router, and existing transaction-filter tests cover navigation, period sharing, reloads, empty states, and chart interactions.
