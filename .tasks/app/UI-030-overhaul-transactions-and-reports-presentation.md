---
id: "UI-030"
title: "Overhaul transactions and reports presentation"
status: "To Do"
priority: "Medium"
type: "Refactor"
parent: "app:UI-025"
milestone: "0.9.0"
depends_on: ["app:UI-027"]
last_updated: "2026-09-13"
---

## Summary

Make ledger history and reports readable using the existing tested report outputs.

## Acceptance Criteria

- [ ] Transaction rows, filters, details, creation, and editing use consistent money alignment, dates, direction labels, and primary actions.
- [ ] Period summaries, group spending, quality breakdown, cumulative pace, and the day calendar follow the chosen chart and type treatment.
- [ ] Draft unknowns, transfers, adjustments, empty periods, and unavailable historical figures remain distinguishable and retain their existing reporting semantics.
- [ ] Existing report and editing tests pass; iPhone review covers large VND values, long labels, dense periods, readable chart alternatives, and larger text.
