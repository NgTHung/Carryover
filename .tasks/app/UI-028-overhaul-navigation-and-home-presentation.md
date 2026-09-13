---
id: "UI-028"
title: "Overhaul navigation and Home presentation"
status: "To Do"
priority: "Medium"
type: "Refactor"
parent: "app:UI-025"
milestone: "0.9.0"
depends_on: ["app:UI-027"]
last_updated: "2026-09-13"
---

## Summary

Make the daily figures and main actions easy to find once every destination exists.

## Acceptance Criteria

- [ ] Navigation exposes capture, drafts, transactions, reports, People, and Settings with consistent back and return behavior.
- [ ] Home gives per day the primary hierarchy while clearly showing discretionary, carryover balance, runway, horizon, receivables, and unknowns where applicable.
- [ ] Loading, stale, unavailable, overspent, and zero-divisor states follow the documented design without hiding uncertainty or substituting zero.
- [ ] Home renders the existing snapshot unchanged; route regression tests and an iPhone review cover safe areas, larger text, and one-thumb access.
