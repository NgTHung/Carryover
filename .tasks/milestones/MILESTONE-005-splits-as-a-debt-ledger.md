---
id: "MILESTONE-005"
title: "Splits as a debt ledger"
status: To Do
priority: "Medium"
type: "Milestone"
milestone: "0.5.0"
last_updated: 2026-09-13
---

## Summary

Stage 4. Contacts, split entry, derived per-person balances, settlements, and the People screen. Splitting is a ledger problem, not a budgeting one. The budget charges your own share for spending, the account projection follows the payer, and only a contact share from an expense you paid is a receivable. Settlements are debt-ledger-only in v1.

## Exit Criteria

- [ ] Share rows sum to the transaction amount exactly, with the remainder assigned to the payer.
- [ ] A split where a contact paid produces a debt you owe rather than a receivable.
- [ ] Split entry keeps fields editable and accepted allocations valid without a remainder repair step, following the resolved SPLIT-002 boundary contract.
- [ ] The budget charges your own share and never the full transaction amount.
- [ ] Settlements clear receivables, never touch the budget, and are never income.
- [ ] The People screen shows a balance per contact and settles partial amounts.
- [x] The stage is split into a boundary contract and Feature tasks before implementation starts.
