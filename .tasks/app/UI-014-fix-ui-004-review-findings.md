---
id: "UI-014"
title: "Fix UI-004 review findings"
status: In Progress
priority: "High"
type: "Bug"
milestone: "0.3.0"
depends_on: ["UI-004"]
risk: "High"
impact: "Orphaned active share reads can stop the home snapshot after a split transaction is deleted, while amount-only chart labels leave quality segments dependent on color."
tags: ["ui", "reports"]
last_updated: 2026-09-12
---

## Summary

Keep shared split reads aligned with active transactions and identify every direct quality segment label in text.

## Acceptance Criteria

- [ ] Normal share reads exclude rows whose transaction is soft-deleted, while audit reads can still include them.
- [ ] Deleting a split transaction cannot make budget own-share resolution fail.
- [ ] Every visible direct quality segment label includes the quality name and amount.
