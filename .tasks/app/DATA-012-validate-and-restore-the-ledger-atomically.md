---
id: "DATA-012"
title: "Validate and restore the ledger atomically"
status: "To Do"
priority: "High"
type: "Feature"
parent: "app:DATA-008"
milestone: "0.6.0"
depends_on: ["app:DATA-011", "app:DATA-015"]
last_updated: "2026-09-13"
---

## Summary

Restore only a fully validated backup so malformed input cannot partially replace your ledger.

## Acceptance Criteria

- [ ] Raw JSON amount tokens are checked before lossy numeric conversion; fractional, unsafe, malformed, unsupported, or inconsistent input is rejected before any write.
- [ ] Restore validates all rows and references, then replaces ledger contents atomically without mixing seeded or existing rows into the backup.
- [ ] Successful restore refreshes database reads, draft notification state, and the existing snapshot publication path; absent photo files leave explicit unavailable images. DATA-015 prepares the current period and reconciles its actual income total before publication, preserving imported historical money totals exactly.
- [ ] Tests distinguish backup round-trip fidelity from subsequent current-period preparation, including restoring after several periods away. Versioned restore validation does not silently rewrite history through manual-entry date defaults or replace missing historical config with current settings.
- [ ] Real SQLite tests prove rollback on injected failure and exact round trips for all rows and amounts, unknowns, historical month config, and budget snapshots under the same date inputs.
