---
id: "SPLIT-006"
title: "Derive contact balances and settlement allocation"
status: "To Do"
priority: "High"
type: "Feature"
parent: "app:SPLIT-001"
milestone: "0.5.0"
depends_on: ["app:SPLIT-005"]
last_updated: "2026-09-13"
---

## Summary

Derive what each contact owes or is owed from ledger rows so balances cannot drift from edited history.

## Acceptance Criteria

- [ ] Pure functions derive receivables and amounts you owe from active shares, payer identity, and settlements, including opposite debts.
- [ ] Partial settlements allocate oldest first with stable tie ordering and follow the documented netting and overpayment rules.
- [ ] History edits and soft deletion produce the documented result without storing a second running contact balance.
- [ ] Tests prove exact integer allocation and stable results for equal timestamps, opposite debts, both settlement directions, and edited history.
