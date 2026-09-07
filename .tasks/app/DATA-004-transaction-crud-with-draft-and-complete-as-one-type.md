---
id: "DATA-004"
title: "Transaction CRUD with draft and complete as one type"
status: Done
priority: "High"
type: "Feature"
milestone: "0.2.0"
depends_on: ["DATA-001", "DATA-003"]
risk: "High"
impact: "The transactions table is the ledger. Its shape decides whether a draft can ever be mistaken for a complete transaction, which is what turns an unknown into a silent zero."
tags: ["data", "transactions"]
last_updated: 2026-09-07
---

## Summary

A draft and a complete transaction share one table and one type, separated by `status`. Model them as a discriminated union, not a bag of optional fields, so code that reads an amount cannot compile against a draft that has none.

Define the domain union with Zod and infer its TypeScript type. Validate create, edit, and completion through the same data boundary, using the shared money schemas from DATA-001. For edits, validate the resulting transaction before writing. Screens reuse these schemas for feedback; database constraints and checks for an active leaf remain in the data layer. Follow `docs/state-and-validation.md`.

Every transaction write that supplies a category must call DATA-003's active-leaf validator. DATA-003 owns the category relationship check; this task owns using it for transaction create, edit, and completion.

Direction is `expense`, `income`, `adjustment`, or `transfer`, and it carries the sign. The amount is always positive. Income has no category and a free-text source label instead, because categorising income doubles the taxonomy for almost no insight.

A transaction also carries `payer_contact_id`, nullable, where null means you. Nothing in this task splits anything, but the column is written and read here so SPLIT-001 does not need a migration on the ledger's central table.

Deletes are soft. History stays freely editable, which is only safe because config is snapshotted per period in DATA-005.

## Acceptance Criteria

- [x] Draft and complete are one Zod discriminated union on `status`, with an inferred TypeScript type and a required amount on the complete variant.
- [x] A complete transaction requires an amount; a complete expense also requires a leaf category. A draft requires neither, and income has no category.
- [x] Amounts are positive integers and direction carries the sign, checked by a test per direction.
- [x] Income stores an optional source label and no category.
- [x] Transaction create, edit, and completion use DATA-003's active-leaf validator and reject missing, deleted, or group category IDs without changing the stored transaction.
- [x] `payer_contact_id` round-trips, and a null reads back as you.
- [x] Delete is a soft delete and the row reads back as absent from normal queries.
- [x] `tests/` covers create, edit, complete a draft, and soft delete.
- [x] Tests reject invalid create, edit, and completion inputs without changing the stored row. Blank or omitted draft amounts stay null, and fractional, zero, negative, or unsafe amounts are refused without rounding.
