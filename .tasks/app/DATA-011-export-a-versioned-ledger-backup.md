---
id: "DATA-011"
title: "Export a versioned ledger backup"
status: "To Do"
priority: "High"
type: "Feature"
parent: "app:DATA-008"
milestone: "0.6.0"
depends_on: ["app:SPLIT-001"]
last_updated: "2026-09-13"
---

## Summary

Define a portable backup format and read a consistent ledger view so export cannot mix rows from different mutations.

## Acceptance Criteria

- [ ] The versioned format includes every persisted ledger table, ids, timestamps, soft-deleted rows, stored month config, and photo keys; photo bytes and transient UI state are excluded.
- [ ] Export reads a consistent database snapshot and emits every amount as an exact integer with no fractional intermediate arithmetic.
- [ ] Shared Zod schemas define rows, money bounds, and version metadata; the format documents supported versions and reference requirements.
- [ ] Real SQLite tests export a fixture containing unknown drafts, both split payer kinds, settlements, transfers, adjustments, and deleted rows, asserting every amount and reference.
