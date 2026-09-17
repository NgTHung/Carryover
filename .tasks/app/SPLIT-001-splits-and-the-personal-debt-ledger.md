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
last_updated: 2026-09-17
---

## Summary

Stage 4 completes the personal debt ledger before the UI overhaul. SPLIT-002 resolves boundary rules, then SPLIT-003 through SPLIT-008 cover contacts, share arithmetic, atomic persistence, derived balances, settlements, and the working screens.

The settled shape: contacts are local records with a nullable `user_id`, which is the hook that lets a real account claim the history later. A split writes one share row per participant including you, and the shares sum to the transaction amount exactly. Remainder dong go to the payer, deterministically, so recomputation is stable.

The payer is named by `transactions.payer_contact_id`, nullable, where null means you. Someone else paying is a normal case, not an edge one, and the ledger could not record it before this column existed.

The budget charges your own share for spending, category, quality, and burn. Account projection deducts the full expense when you paid and does not move an account when a contact paid. The rest is a receivable only when you paid; a contact-paid split creates what you owe that payer. A settlement is debt-ledger-only in v1, so it never changes an account, budget figure, or income report.

The interaction in docs/DESIGN.md section 6.1 uses editable shares and a payer share that absorbs the balance when an accepted allocation permits it. SPLIT-002 resolves its unlimited-input promise against positive integer amounts, payer edits, and insufficient dong for all participants before arithmetic is implemented. Accepted allocations must sum exactly without asking you to repair a remainder. Storage validation remains mandatory.

## Exit Criteria

- [ ] Contacts are local records with a nullable `user_id`.
- [ ] Share rows sum to the transaction amount exactly, with remainder dong assigned to the payer.
- [ ] The payer is stored on the transaction, and a split where a contact paid produces a debt you owe rather than a receivable.
- [ ] Split entry has no allocation mode: every share remains editable, non-payer edits recompute the payer balance, and payer edits preserve the typed value only when the weighted remainder can be allocated as positive integers.
- [ ] Typing in the payer's own field accepts an exact weighted remainder, while incompatible raw text stays pending with the last accepted allocation unchanged and an actionable explanation.
- [ ] Equally and Shares write amounts into the fields and lock nothing afterwards.
- [ ] Every accepted allocation is valid without a remainder repair step; invalid input preserves the last valid allocation and never bypasses money validation, following the resolved SPLIT-002 contract.
- [ ] The budget charges your own share for spending and reports, while account projection follows the payer and may deduct the full transaction amount when you paid.
- [ ] Balances per contact are derived from unsettled shares rather than stored.
- [ ] Settlements apply oldest first with deterministic ties, never touch accounts or budget figures, and are never income.
- [ ] Contact, split, and settlement inputs use Zod schemas with shared money validation. Pure functions own share arithmetic, and the data layer checks references and exact share totals before an atomic write.
- [ ] The People screen shows a balance per contact and settles partial amounts.
- [x] The stage is split into a boundary contract and Feature tasks before implementation starts.
