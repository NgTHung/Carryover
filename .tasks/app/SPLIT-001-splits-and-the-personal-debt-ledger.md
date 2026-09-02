---
id: "SPLIT-001"
title: "Splits and the personal debt ledger"
status: To Do
priority: "Medium"
type: "Epic"
milestone: "0.5.0"
depends_on: ["CAPTURE-001"]
risk: "High"
impact: "Four invariants live in this stage. Getting the remainder or the settlement direction wrong corrupts both the debt ledger and every month-over-month comparison."
tags: ["split", "settlements", "epic"]
last_updated: 2026-09-02
---

## Summary

Stage 4, held at epic size until stage 3 lands. Splits are a ledger problem, not a budgeting one.

The settled shape: contacts are local records with a nullable `user_id`, which is the hook that lets a real account claim the history later. A split writes one share row per participant including you, and the shares sum to the transaction amount exactly. Remainder dong go to the payer, deterministically, so recomputation is stable.

The budget charges your share and the rest is a receivable shown beside discretionary. A repayment is never income. Treating it as income double-counts and corrupts every month-over-month comparison, which is the kind of error you notice six months late.

## Exit Criteria

- [ ] Contacts are local records with a nullable `user_id`.
- [ ] Share rows sum to the transaction amount exactly, with remainder dong assigned to the payer.
- [ ] The budget charges your own share and never the full transaction amount.
- [ ] Balances per contact are derived from unsettled shares rather than stored.
- [ ] Settlements apply oldest first, never touch the budget, and are never income.
- [ ] The People screen shows a balance per contact and settles partial amounts.
- [ ] The stage is split into Feature tasks before implementation starts.
