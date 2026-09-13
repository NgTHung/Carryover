---
id: "UI-031"
title: "Overhaul People and Settings presentation"
status: "To Do"
priority: "Medium"
type: "Refactor"
parent: "app:UI-025"
milestone: "0.9.0"
depends_on: ["app:UI-027"]
last_updated: "2026-09-13"
---

## Summary

Apply the same interface patterns to the debt ledger and maintenance flows so occasional actions remain understandable.

## Acceptance Criteria

- [ ] People, contact history, and settlement controls clearly distinguish receivables from amounts you owe and use the shared money treatment.
- [ ] Accounts, reconcile, transfers, commitments, categories, and backup form a coherent Settings structure with consistent edit and return behavior.
- [ ] Settlement, deletion, and restore actions describe their effects and preserve the existing cancellation, retry, and persistence behavior.
- [ ] Existing functional tests pass; iPhone review covers long contact names, errors, keyboard access, and explicit restore replacement.
