---
id: "UI-024"
title: "Edit bank and cash account details"
status: In Progress
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["app:DATA-002", "app:DATA-007", "app:DATA-015"]
last_updated: 2026-09-15
---

## Summary

Complete the account controls around the two fixed accounts. Reuse reconcile for corrections after setup.

## Execution Plan

Follow [the UI-024 execution plan](../../docs/plans/UI-024.md) for the validated account edit API, form behavior, period preparation, commit stages, and verification. Planning leaves this task To Do.

## Acceptance Criteria

- [ ] You can edit account names and opening balances through the validated account data API, extended to save both fields atomically, while preserving bank and cash identities and the bank default.
- [ ] Opening balance editing explains its historical effect; routine balance correction remains reachable through reconcile.
- [ ] Account edits refresh affected reads and the snapshot through DATA-015 period preparation without recomputing stored opening or reserve snapshots. Changing an account opening balance changes the live ledger projection, not actual income or past configuration money totals.
- [ ] Database and component tests cover integer money, invalid input, cancelled edits, and consistency with reconcile.
