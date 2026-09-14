---
id: "DATA-005"
title: "Per-period month config snapshots"
status: Done
priority: "High"
type: "Feature"
milestone: "0.3.0"
depends_on: ["DATA-004"]
risk: "High"
impact: "Invariant 7, the one that breaks quietly. Without a frozen snapshot per period, changing income or reserves today silently rewrites what discretionary meant in every past month."
tags: ["data", "budget", "invariant"]
last_updated: 2026-09-13
---

## Summary

Policy revision, 2026-09-13: DATA-015 supersedes this task's original freeze-at-opening rule for income. The current period's stored income total will track actual ledger income; past money totals remain frozen. See docs/spec/period-income-policy.md. This Done task records the original implementation and its verified criteria, not completion of the revised policy.

A `month_config` row per period holds opening balance, income total, reserved total, and horizon date. It is written when the period opens and read back from storage for every report.

History is freely editable, which is a deliberate choice and only safe because config is frozen per period. Recomputing config from current settings would mean a raise in June rewrote May. Nothing in the app crashes when that happens, which is exactly why it needs a test rather than vigilance.

The period boundary is the first of the month, stored as configuration rather than hardcoded.

In the original implementation, the caller supplies the three money totals when the period first opens. Opening
the same period again returns its stored snapshot without replacing those
totals. The boundary day lives in code configuration. A horizon may extend
beyond the period, but it cannot precede the period start.

## Acceptance Criteria

- [x] A `month_config` row is written when a period opens, holding opening balance, income total, reserved total, and horizon date.
- [x] Zod validates period and horizon dates and reuses DATA-001 money schemas before writes. Invalid input leaves stored month config unchanged.
- [x] Every report reads `month_config` from storage and nothing recomputes it from current settings.
- [x] The horizon defaults to the end of the period and is editable per period.
- [x] The period boundary is read from configuration, not a literal in the code.
- [x] `tests/` edits a past transaction and changes today's commitments, then asserts a past period's stored figures are unchanged.
