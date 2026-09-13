---
id: "UI-023"
title: "Record transfers between bank and cash"
status: "To Do"
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["app:DATA-002", "app:UI-001"]
last_updated: "2026-09-13"
---

## Summary

Make the existing transfer operation reachable from Accounts so you can track movement between bank and cash.

## Acceptance Criteria

- [ ] You can choose two distinct active accounts, enter a positive integer VND amount and date, and record a transfer.
- [ ] Transfer details are reachable from the transaction list and clearly identify both accounts; no expense or income is created.
- [ ] Cancel and failed writes preserve the ledger; a successful write refreshes account balances and the snapshot through existing APIs.
- [ ] Database and component tests prove both account effects, unchanged spending and income reports, invalid input rejection, and restart persistence.
