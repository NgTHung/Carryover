---
id: "DATA-007"
title: "Reconcile writes a visible adjustment"
status: In Progress
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["DATA-002", "DATA-004"]
risk: "Medium"
impact: "Cash drift makes the balance, the runway, and therefore the headline figure slightly less true every week. Reconcile is the only correction path."
tags: ["data", "accounts", "reconcile"]
last_updated: 2026-09-09
---

## Summary

You state what you actually hold and the app writes one adjustment transaction for the difference. Expect to use it weekly at first.

The adjustment is visible in the transaction list so drift stays honest, and it is excluded from report totals so reconciling never looks like a phantom purchase. Reconciling is routine maintenance, not an admission of failure, and the accounts screen uses that language.

An adjustment stores a positive amount and an explicit increase or decrease effect. A migration must stop when an older adjustment has no effect because its account impact cannot be inferred safely.

## Acceptance Criteria

- [ ] Reconcile takes the amount actually held and writes one adjustment transaction for the difference.
- [ ] Zod validates the stated balance with the shared nonnegative money schema. Tests accept zero and reject fractional or unsafe values without writing an adjustment.
- [ ] The adjustment amount is positive and its explicit increase or decrease effect determines the account balance change.
- [ ] Migration stops before schema changes when an existing adjustment has no effect.
- [ ] The accounts screen reconciles bank and cash with routine maintenance copy and reports whether an adjustment was written.
- [ ] The adjustment appears distinctly in the transaction list and opens a read-only detail view.
- [ ] The expense and income report-total contract excludes adjustments, asserted by a test.
- [ ] Reconciling to the current balance writes nothing.
