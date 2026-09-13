---
id: "BUILD-005"
title: "Verify all v1 functionality on the iPhone"
status: "To Do"
priority: "High"
type: "TestDebt"
milestone: "0.8.0"
depends_on: ["build:BUILD-004", "app:UI-020", "app:UI-021", "app:UI-022", "app:UI-023", "app:UI-024", "app:CAPTURE-001", "app:SPLIT-001", "app:DATA-008", "build:WIDGET-002"]
last_updated: "2026-09-13"
---

## Summary

Use a repeatable manual candidate checklist to prove the whole app works before presentation changes. Keep BUILD-003 deferred.

## Acceptance Criteria

- [ ] Record a passing candidate revision for local tests, typechecking, Expo diagnostics, web export, and the GitHub Actions unsigned iOS build.
- [ ] The iPhone checklist covers manual expense and income, accounts and reconcile, transfers, commitments, horizon changes, categories, editable history and reports, capture, splits, settlements, backup and restore, and the widget.
- [ ] Verify offline use, restart persistence, cancelled actions, permission denial, unknown drafts, period rollover, and snapshot refresh; map all nine invariants to passing tests.
- [ ] Reconcile milestone 0.1.0 through 0.7.0 checklists with build and device evidence. File and resolve discovered functional defects before completion; presentation findings feed the later UI overhaul.
