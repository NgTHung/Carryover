---
id: "MILESTONE-005"
title: "Splits as a debt ledger"
status: To Do
priority: "Medium"
type: "Milestone"
milestone: "0.5.0"
last_updated: 2026-09-06
---

## Summary

Stage 4. Contacts, split entry, derived per-person balances, settlements, and the People screen. Splitting is a ledger problem, not a budgeting one. The budget charges your share and the rest is a receivable.

## Exit Criteria

- [ ] Share rows sum to the transaction amount exactly, with the remainder assigned to the payer.
- [ ] A split where a contact paid produces a debt you owe rather than a receivable.
- [ ] Split entry has no modes and no state of it can fail validation or block Done.
- [ ] The budget charges your own share and never the full transaction amount.
- [ ] Settlements clear receivables, never touch the budget, and are never income.
- [ ] The People screen shows a balance per contact and settles partial amounts.
- [ ] The stage is split into Feature tasks before implementation starts.
