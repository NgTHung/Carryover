---
id: "UI-012"
title: "Compute and read stored period summaries"
status: In Progress
priority: "High"
type: "Feature"
parent: "UI-004"
milestone: "0.3.0"
depends_on: ["DATA-010", "DATA-005"]
risk: "High"
impact: "The report arithmetic is the source of truth for period group and quality totals, including historical month config and split shares."
tags: ["reports"]
last_updated: 2026-09-12
---

## Summary

Build a pure period-summary engine and a consistent SQLite read model for the selected period. Preserve stored month_config and keep all money arithmetic integer-only.

## Acceptance Criteria

- [ ] The pure report aggregates own expense shares by group, leaf, and need, want, regret, or unrated quality.
- [ ] Income, transfers, adjustments, and unknown drafts appear in no money total; known drafts remain visible under No group yet.
- [ ] Group and quality totals equal total spending exactly, with deterministic ordering and integer VND validation.
- [ ] The read model returns the selected period's stored month_config and active ledger rows from one consistent SQLite view.
- [ ] Logic and real-SQLite tests cover historical config snapshots, deleted labels, transfers, adjustments, drafts, and invalid shares.
