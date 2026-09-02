---
id: "DATA-001"
title: "Schema and migrations for the ledger"
status: To Do
priority: "High"
type: "Feature"
milestone: "0.2.0"
depends_on: ["build:BUILD-001"]
risk: "High"
impact: "Every later stage writes through this schema. A wrong column type corrupts money silently, and retrofitting UUID keys, updated_at, or soft deletes once real data exists is the expensive path."
tags: ["data", "schema", "sqlite"]
last_updated: 2026-09-02
---

## Summary

Nine tables on expo-sqlite with Drizzle: accounts, categories, transactions, contacts, splits, settlements, commitments, month_config, and transfers. Every table carries a UUID id, `created_at`, `updated_at`, and `deleted_at`. Those four columns are the whole sync-readiness bet. They cost almost nothing in migration one and cost a data migration later.

Amounts are `INTEGER` VND. Direction carries the sign, so no column ever holds a negative amount. `CURRENCY_EXPONENT` currently sits in `src/budget/snapshot.ts` because that was the only module that needed it. The schema and the engine both need it now, so it moves to its own module and both import it.

SQLite has no integer-only guarantee on a column that JavaScript can write a float into, so the refusal belongs in the write path and in a test, not in the column type alone.

## Acceptance Criteria

- [ ] One migration creates all nine tables with the columns named in `docs/spec/carryover-v1.md`.
- [ ] Every table has a UUID text id plus `created_at`, `updated_at`, and `deleted_at`.
- [ ] Every amount column is `INTEGER` and every write path refuses a non-integer amount with an error, not a rounded value.
- [ ] `CURRENCY_EXPONENT` lives in one module that the schema, the engine, and the widget all import.
- [ ] Reads exclude soft-deleted rows unless a caller asks for them explicitly.
- [ ] `tests/` covers a write and read back for one row per table, plus a float amount that is refused.
