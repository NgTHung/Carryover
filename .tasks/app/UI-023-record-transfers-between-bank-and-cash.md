---
id: "UI-023"
title: "Record transfers between bank and cash"
status: In Progress
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["app:DATA-002", "app:UI-001"]
last_updated: 2026-09-15
---

## Summary

Make the existing transfer operation reachable from Accounts so you can track movement between bank and cash.

## Execution Plan

Follow [the UI-023 execution plan](../../docs/plans/UI-023.md) for the transfer form, validated write and detail read APIs, navigation, failure recovery, commit stages, and verification. This planning update leaves the task To Do and its acceptance criteria unchecked.

## Acceptance Criteria

- [ ] You can choose two distinct active accounts, enter a positive integer VND amount and date, and record a transfer.
- [ ] Transfer details are reachable from the transaction list and clearly identify both accounts; no expense or income is created.
- [ ] Cancel and failed writes preserve the ledger; a successful write refreshes account balances and the snapshot through existing APIs.
- [ ] Database and component tests prove both account effects, unchanged spending and income reports, invalid input rejection, and restart persistence.
