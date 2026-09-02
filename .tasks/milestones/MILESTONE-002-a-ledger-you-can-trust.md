---
id: "MILESTONE-002"
title: "A ledger you can trust"
status: To Do
priority: "High"
type: "Milestone"
milestone: "0.2.0"
last_updated: 2026-09-02
---

## Summary

Stage 1. The schema, the accounts, the two-level taxonomy, and transaction CRUD. No budget arithmetic yet. This stage exists to make money storable correctly, because every figure the app reports later is read out of these tables and a wrong column type here corrupts data quietly for months.

The sync-ready columns land in migration one. UUID keys, `updated_at`, and soft deletes cost little now and are expensive to retrofit once real data exists.

## Exit Criteria

- [ ] One migration creates every table with a UUID key, `created_at`, `updated_at`, and `deleted_at`.
- [ ] Amounts are stored as `INTEGER` VND and a test fails if a float reaches the database.
- [ ] Accounts, categories, and transactions are creatable, editable, and soft-deletable from the app.
- [ ] The starter category seed loads on first run and bulk-deletes in one action.
- [ ] The transaction list filters by period, category, account, and quality.
