---
id: "DATA-008"
title: "JSON backup and restore"
status: To Do
priority: "Medium"
type: "Epic"
milestone: "0.6.0"
depends_on: ["SPLIT-001"]
risk: "Medium"
impact: "The only protection against losing the phone. A backup that has never been restored is an assumption, not a backup."
tags: ["data", "backup", "epic"]
last_updated: 2026-09-07
---

## Summary

Stage 5, held at epic size. Sync across devices is deliberately out of scope for v1. Backup covers the risk that matters now.

Amounts stay integers through the JSON. A serializer that emits a float for an amount breaks invariant 1 in the one place tests rarely look, so the round trip needs an equality assertion on every amount rather than a spot check.

Photo export is optional and separate from the JSON, because roughly 48MB a year does not belong in a file you want to move around casually.

Use a versioned Zod schema for the backup, reusing domain and money validation from the write boundary. Validate the full payload and its references before changing stored data, then apply the restore atomically. Follow `docs/state-and-validation.md` for amount parsing and state refresh after restore.

## Exit Criteria

- [ ] Export writes every table to JSON with amounts as integers.
- [ ] Export explicitly includes soft-deleted rows. Restore validates the version, all rows, money bounds, and references before writing; malformed or unsupported input leaves the existing ledger unchanged.
- [ ] Tests cover exact amount round-trips, unknown drafts, and rejection of fractional or unsafe JSON amounts before lossy numeric conversion can hide invalid input.
- [ ] A successful restore refreshes database reads and publishes a newly computed snapshot through the BUDGET-002 path. Zustand UI state is not part of the ledger backup.
- [ ] Restore rebuilds a wiped install, and every budget figure matches the source device.
- [ ] Bulk photo export is available and separate from the JSON export.
- [ ] A restore has been run on a wiped install before this milestone closes.
- [ ] Local Jest integration tests exercise restore against real SQLite. The on-demand Maestro suite adds a restore flow using a versioned fixture and verifies the resulting home snapshot before release.
- [ ] The stage is split into Feature tasks before implementation starts.
