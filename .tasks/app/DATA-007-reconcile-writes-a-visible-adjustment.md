---
id: "DATA-007"
title: "Reconcile writes a visible adjustment"
status: To Do
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["DATA-002", "DATA-004"]
risk: "Medium"
impact: "Cash drift makes the balance, the runway, and therefore the headline figure slightly less true every week. Reconcile is the only correction path."
tags: ["data", "accounts", "reconcile"]
last_updated: 2026-09-02
---

## Summary

You state what you actually hold and the app writes one adjustment transaction for the difference. Expect to use it weekly at first.

The adjustment is visible in the transaction list so drift stays honest, and it is excluded from every report so reconciling never looks like a phantom purchase. Reconciling is routine maintenance, not an admission of failure, and the UI copy should read that way.

## Acceptance Criteria

- [ ] Reconcile takes the amount actually held and writes one adjustment transaction for the difference.
- [ ] The adjustment amount is positive and direction carries the sign.
- [ ] The adjustment appears in the transaction list.
- [ ] No report counts an adjustment as spending or income, asserted by a test.
- [ ] Reconciling to the current balance writes nothing.
