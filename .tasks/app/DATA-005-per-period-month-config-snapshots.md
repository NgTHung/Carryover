---
id: "DATA-005"
title: "Per-period month config snapshots"
status: To Do
priority: "High"
type: "Feature"
milestone: "0.3.0"
depends_on: ["DATA-004"]
risk: "High"
impact: "Invariant 7, the one that breaks quietly. Without a frozen snapshot per period, changing income or reserves today silently rewrites what discretionary meant in every past month."
tags: ["data", "budget", "invariant"]
last_updated: 2026-09-02
---

## Summary

A `month_config` row per period holds opening balance, income total, reserved total, and horizon date. It is written when the period opens and read back from storage for every report.

History is freely editable, which is a deliberate choice and only safe because config is frozen per period. Recomputing config from current settings would mean a raise in June rewrote May. Nothing in the app crashes when that happens, which is exactly why it needs a test rather than vigilance.

The period boundary is the first of the month, stored as configuration rather than hardcoded.

## Acceptance Criteria

- [ ] A `month_config` row is written when a period opens, holding opening balance, income total, reserved total, and horizon date.
- [ ] Every report reads `month_config` from storage and nothing recomputes it from current settings.
- [ ] The horizon defaults to the end of the period and is editable per period.
- [ ] The period boundary is read from configuration, not a literal in the code.
- [ ] `tests/` edits a past transaction and changes today's commitments, then asserts a past period's stored figures are unchanged.
