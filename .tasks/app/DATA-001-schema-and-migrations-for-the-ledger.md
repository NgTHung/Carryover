---
id: "DATA-001"
title: "Schema and migrations for the ledger"
status: Done
priority: "High"
type: "Feature"
milestone: "0.2.0"
depends_on: ["build:BUILD-001", "build:BUILD-002"]
risk: "High"
impact: "Every later stage writes through this schema. A wrong column type corrupts money silently, and retrofitting UUID keys, updated_at, or soft deletes once real data exists is the expensive path."
tags: ["data", "schema", "sqlite"]
last_updated: 2026-09-07
---

## Summary

Nine tables on expo-sqlite with Drizzle: accounts, categories, transactions, contacts, splits, settlements, commitments, month_config, and transfers. Every table carries a UUID id, `created_at`, `updated_at`, and `deleted_at`. Those four columns are the whole sync-readiness bet. They cost almost nothing in migration one and cost a data migration later.

Amounts are `INTEGER` VND. Direction carries the sign, so no column ever holds a negative amount. `CURRENCY_EXPONENT` lives in `src/money/currency.ts`, which the schema, budget module, and widget import so the assumption has one owner.

`transactions` carries `payer_contact_id`, nullable, where null means you. It sits on the transaction rather than on a split row because exactly one participant paid, and it is nullable so the common unsplit case stays free of a join. Invariant 3 sends remainder dong to the payer and `settlements.direction` already supports `i_paid_them`, so the payer was assumed before the schema could name one.

SQLite has no integer-only guarantee on a column that JavaScript can write a float into, so the refusal belongs in the write path and in a test, not in the column type alone.

The transaction row keeps a nullable `note` for the user's exact description, and a nullable `source_label` for unclassified income. Categories also carry `is_suggestion` so the starter seed can be removed without confusing seeded rows with user-created categories.

Use shared Zod money schemas at application write boundaries and in the ORM adapters. Keep the currency constants and display helpers independent of Zod so the widget imports only what it needs. The validation and state contract is in `docs/state-and-validation.md`.

BUILD-002 supplies the Jest runner. Keep regression tests against real SQLite and run them locally on Linux; component mocks cannot prove these constraints.

## Review findings

Reopened on 2026-09-06 after review found two P2 issues.

Soft-delete filtering is optional at each call site. `activeRowFilter` is only a predicate, and an ordinary Drizzle select returns deleted rows. The existing test adds the predicate itself, so it does not prove that the public read API hides deleted rows by default. Add that default to the public read API, with an explicit `includeDeleted` option for backup and historical references.

SQL amount constraints check storage type and sign but omit the safe-integer ceiling enforced by the ORM adapters. A direct SQL insert of 9007199254740993 succeeds, then an ORM read fails. Apply the same upper bound to every amount column and cover inserts and updates that bypass ORM validation.

A follow-up review found that the safe-bound migration allowed previously stored unsafe amounts to survive, leaving ORM reads unable to decode the ledger. It also found that the real SQLite test adapter returned a nested array for single-row reads. Validate existing amounts before installing the triggers and preserve Drizzle's one-row result shape in the adapter.

## Acceptance Criteria

- [x] One migration creates all nine tables with the columns named in `docs/spec/carryover-v1.md`.
- [x] Every table has a UUID text id plus `created_at`, `updated_at`, and `deleted_at`.
- [x] `transactions.payer_contact_id` is nullable and a null reads back as you rather than as a missing contact.
- [x] `transactions.note` is nullable text and round-trips unchanged for both draft and complete rows.
- [x] Every amount column is `INTEGER` and every write path refuses a non-integer amount with an error, not a rounded value.
- [x] `CURRENCY_EXPONENT` lives in one module that the schema, the engine, and the widget all import.
- [x] Public reads exclude soft-deleted rows by default, with an explicit `includeDeleted` option. Tests call that API without supplying a filter.
- [x] `tests/` covers a write and read back for one row per table, plus a float amount that is refused.
- [x] Shared Zod schemas validate positive amounts and nonnegative opening balances and totals, with inferred types and one owner for currency bounds.
- [x] Every amount column rejects values above `Number.MAX_SAFE_INTEGER` in SQLite as well as at the application boundary.
- [x] Tests cover direct SQL inserts and updates for every amount column: the maximum safe integer succeeds, and larger values fail before persistence.
- [x] ORM tests prove fractional and unsafe amounts are refused and valid amounts round-trip through the shared Zod validation.
- [x] Applying the safe-bound migration rejects previously stored unsafe amounts before the ledger can become unreadable.
