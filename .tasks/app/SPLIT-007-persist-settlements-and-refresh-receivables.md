---
id: "SPLIT-007"
title: "Persist settlements and refresh receivables"
status: "To Do"
priority: "High"
type: "Feature"
parent: "app:SPLIT-001"
milestone: "0.5.0"
depends_on: ["app:SPLIT-006"]
last_updated: "2026-09-13"
---

## Summary

Record settlements through a validated data boundary and refresh contact reads and the published receivable.

## Acceptance Criteria

- [ ] Settlement writes validate the contact, positive integer amount, direction, date, and allocation constraints atomically.
- [ ] Settlement correction and soft deletion follow the resolved history policy without creating expense or income transactions.
- [ ] Reads and the existing snapshot publication path refresh after mutations; settlements leave budget figures and spending or income reports unchanged.
- [ ] Real SQLite tests cover partial settlement, both directions, failed writes, repeated submission protection, correction, and snapshot invariants.
