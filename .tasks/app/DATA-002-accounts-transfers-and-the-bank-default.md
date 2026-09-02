---
id: "DATA-002"
title: "Accounts, transfers, and the bank default"
status: To Do
priority: "Medium"
type: "Feature"
milestone: "0.2.0"
depends_on: ["DATA-001"]
risk: "Medium"
impact: "Account balances feed the carryover balance, which feeds every figure on the home screen and the widget."
tags: ["data", "accounts"]
last_updated: 2026-09-02
---

## Summary

Two accounts, bank and cash, with bank as the default. Cash exists because some spending has to be cash, not because the model wants two accounts.

An account balance is derived from its opening balance plus its transactions. Storing a running total would create a second source of truth that drifts from the ledger the first time an edit lands out of order.

Transfers move money between your own accounts. Withdrawing cash is not spending, so a transfer is excluded from every report. Logging transfers stays optional because reconcile can absorb the difference instead.

## Acceptance Criteria

- [ ] First run seeds a bank account and a cash account, with bank marked default.
- [ ] Opening balance is editable and stored as integer VND.
- [ ] The account balance is derived from opening balance plus transactions, with no stored running total.
- [ ] A transfer records a from account, a to account, and a positive amount.
- [ ] `tests/` asserts a transfer changes both account balances and moves neither spending nor income.
