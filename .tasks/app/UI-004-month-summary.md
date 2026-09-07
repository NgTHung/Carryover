---
id: "UI-004"
title: "Month summary"
status: To Do
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["BUDGET-001", "DATA-005", "UI-001"]
risk: "Low"
impact: "The only place the need, want, regret axis pays off. It also proves the stored month config is being read rather than recomputed."
tags: ["ui", "reports"]
last_updated: 2026-09-06
---

## Summary

Spend by group for a period, the need, want, and regret split, and the regretted total called out on its own. Reporting happens at the group because that is what two levels are for.

Past periods read their stored `month_config`. That is the visible payoff of DATA-005, and a past month whose figures move after an edit is the bug this screen would reveal first.

`docs/DESIGN.md` section 8 specifies both charts. Spend by group is ranked horizontal bars rather than a pie, because the comparison that matters is between quantities that sit close together. Quality is one stacked bar with 2px gaps and direct labels, which the palette section marks as mandatory rather than polish.

The two day-level charts in that section are UI-005. They wait because the pace line has nothing to draw until a period has completed.

## Acceptance Criteria

- [ ] Spend by group for the selected period, counting your own shares only.
- [ ] The need, want, and regret breakdown renders, with the regretted total called out.
- [ ] Transfers and adjustments appear in no total on this screen.
- [ ] Selecting a past period reads that period's stored `month_config`.
- [ ] Period selection reuses the UI-001 Zustand store. Reports read stored ledger data for that period, and store selectors calculate no money totals.
- [ ] Transactions with no quality set are counted in the group totals and shown as unrated.
- [ ] Spend by group is ranked bars and the quality breakdown carries the gaps and direct labels required by `docs/DESIGN.md` section 3.
