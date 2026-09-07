---
id: "DATA-002"
title: "Accounts, transfers, and the bank default"
status: Done
priority: "Medium"
type: "Feature"
milestone: "0.2.0"
depends_on: ["DATA-001"]
risk: "Medium"
impact: "Account balances feed the carryover balance, which feeds every figure on the home screen and the widget."
tags: ["data", "accounts"]
last_updated: 2026-09-07
---

## Summary

Two accounts, bank and cash, with bank as the default. Cash exists because some spending has to be cash, not because the model wants two accounts.

An account balance is derived from its opening balance plus its transactions. Storing a running total would create a second source of truth that drifts from the ledger the first time an edit lands out of order.

Transfers move money between your own accounts. Withdrawing cash is not spending, so a transfer is excluded from every report. Logging transfers stays optional because reconcile can absorb the difference instead.

## Acceptance Criteria

- [x] First run seeds a bank account and a cash account, with bank marked default.
- [x] Opening balance is editable and stored as integer VND.
- [x] Account and transfer inputs use Zod schemas that reuse DATA-001 money validation. Tests reject invalid inputs before any account or transfer is changed.
- [x] The account balance is derived from opening balance plus transactions, with no stored running total.
- [x] A transfer records a from account, a to account, and a positive amount.
- [x] `tests/` asserts a transfer changes both account balances and moves neither spending nor income.
- [x] The Expo migration path seeds both fixed accounts.
- [x] A soft-deleted account does not erase past transfer effects from an active account balance.
