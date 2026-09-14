---
id: "UI-024"
title: "Edit bank and cash account details"
status: "To Do"
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["app:DATA-002", "app:DATA-007", "app:DATA-015"]
last_updated: "2026-09-13"
---

## Summary

Complete the account controls around the two fixed accounts. Reuse reconcile for corrections after setup.

## Acceptance Criteria

- [ ] You can edit supported account names and opening balances through the existing validated data API while preserving bank and cash identities and the bank default.
- [ ] Opening balance editing explains its historical effect; routine balance correction remains reachable through reconcile.
- [ ] Account edits refresh affected reads and the snapshot through DATA-015 period preparation without recomputing stored opening or reserve snapshots. Changing an account opening balance changes the live ledger projection, not actual income or past configuration money totals.
- [ ] Database and component tests cover integer money, invalid input, cancelled edits, and consistency with reconcile.
