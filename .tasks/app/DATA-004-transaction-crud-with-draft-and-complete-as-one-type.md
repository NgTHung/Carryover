---
id: "DATA-004"
title: "Transaction CRUD with draft and complete as one type"
status: To Do
priority: "High"
type: "Feature"
milestone: "0.2.0"
depends_on: ["DATA-001", "DATA-003"]
risk: "High"
impact: "The transactions table is the ledger. Its shape decides whether a draft can ever be mistaken for a complete transaction, which is what turns an unknown into a silent zero."
tags: ["data", "transactions"]
last_updated: 2026-09-02
---

## Summary

A draft and a complete transaction share one table and one type, separated by `status`. Model them as a discriminated union, not a bag of optional fields, so code that reads an amount cannot compile against a draft that has none.

Direction is `expense`, `income`, `adjustment`, or `transfer`, and it carries the sign. The amount is always positive. Income has no category and a free-text source label instead, because categorising income doubles the taxonomy for almost no insight.

Deletes are soft. History stays freely editable, which is only safe because config is snapshotted per period in DATA-005.

## Acceptance Criteria

- [ ] Draft and complete are one discriminated union on `status`, with no optional amount on the complete variant.
- [ ] A complete transaction requires an amount and a leaf category. A draft requires neither.
- [ ] Amounts are positive integers and direction carries the sign, checked by a test per direction.
- [ ] Income stores an optional source label and no category.
- [ ] Delete is a soft delete and the row reads back as absent from normal queries.
- [ ] `tests/` covers create, edit, complete a draft, and soft delete.
