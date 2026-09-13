---
id: "SPLIT-005"
title: "Write and edit splits atomically"
status: "To Do"
priority: "High"
type: "Feature"
parent: "app:SPLIT-001"
milestone: "0.5.0"
depends_on: ["app:SPLIT-003", "app:SPLIT-004"]
last_updated: "2026-09-13"
---

## Summary

Persist the transaction, payer, and shares together so a failed edit cannot change your spending without changing the split.

## Acceptance Criteria

- [ ] Validated creation and editing write one share per participant including you, exact totals, and the transaction payer in one database transaction.
- [ ] Completion, payer or amount edits, split removal, and transaction soft deletion follow the resolved contract, including existing settlement references.
- [ ] Data reads reuse DATA-010 and account payer semantics; snapshot and report refresh happens only after a successful commit.
- [ ] Real SQLite tests inject write failures and verify rollback, reference checks, own-share spending, contact-paid account effects, and historical month config preservation.
