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
last_updated: 2026-09-06
---

## Summary

Stage 4, held at epic size until stage 3 lands. Splits are a ledger problem, not a budgeting one.

The settled shape: contacts are local records with a nullable `user_id`, which is the hook that lets a real account claim the history later. A split writes one share row per participant including you, and the shares sum to the transaction amount exactly. Remainder dong go to the payer, deterministically, so recomputation is stable.

The payer is named by `transactions.payer_contact_id`, nullable, where null means you. Someone else paying is a normal case, not an edge one, and the ledger could not record it before this column existed.

The budget charges your share and the rest is a receivable shown beside discretionary. A repayment is never income. Treating it as income double-counts and corrupts every month-over-month comparison, which is the kind of error you notice six months late.

The entry interface is settled in `docs/DESIGN.md` section 6.1 and it has no modes. Every share is an editable field from the moment the section opens, and the payer's share is the balance, recomputed on each keystroke as the amount minus every other share. The shares therefore sum exactly whatever is typed and every remainder dong lands on the payer by construction, so invariant 3 holds structurally rather than as a rule someone has to remember. There is no remainder readout to drive to zero. The earlier design asked for one and it is rejected: it puts arithmetic in front of you at the worst moment and lets the form sit in a state you have to repair.

## Exit Criteria

- [ ] Contacts are local records with a nullable `user_id`.
- [ ] Share rows sum to the transaction amount exactly, with remainder dong assigned to the payer.
- [ ] The payer is stored on the transaction, and a split where a contact paid produces a debt you owe rather than a receivable.
- [ ] Split entry has no modes: every share is editable throughout, and the payer's share is the balance that absorbs the difference.
- [ ] Typing in the payer's own field is accepted and redistributes the difference across the other shares, with the last typed value surviving.
- [ ] Equally and Shares write amounts into the fields and lock nothing afterwards.
- [ ] No state of the split form can fail validation or block Done.
- [ ] The budget charges your own share and never the full transaction amount.
- [ ] Balances per contact are derived from unsettled shares rather than stored.
- [ ] Settlements apply oldest first, never touch the budget, and are never income.
- [ ] Contact, split, and settlement inputs use Zod schemas with shared money validation. Pure functions own share arithmetic, and the data layer checks references and exact share totals before an atomic write.
- [ ] The People screen shows a balance per contact and settles partial amounts.
- [ ] The stage is split into Feature tasks before implementation starts.
