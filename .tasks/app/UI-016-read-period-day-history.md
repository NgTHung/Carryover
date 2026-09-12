---
id: "UI-016"
title: "Read period day history"
status: "To Do"
priority: "High"
type: "Feature"
parent: "UI-005"
milestone: "0.3.0"
depends_on: ["UI-015"]
risk: "High"
impact: "Provides one consistent SQLite view of selected and reference periods so chart history cannot mix stored configuration or ledger revisions."
tags: ["reports", "charts"]
last_updated: "2026-09-12"
---

## Summary

Extend the period report read model to load selected days and complete historical reference periods from one committed SQLite view.

## Acceptance Criteria

- [ ] The read returns the selected stored month config and all qualifying previous stored configs without recomputing historical settings.
- [ ] Selected and reference transactions, category labels, and active own shares are loaded consistently and grouped by period.
- [ ] Missing configs, soft-deleted rows, transfers, adjustments, and invalid splits cannot create chart totals.
- [ ] Database tests cover current, historical, missing, and incomplete periods with deterministic today input.
