---
id: "DATA-013"
title: "Export and restore from Settings"
status: "To Do"
priority: "Medium"
type: "Feature"
parent: "app:DATA-008"
milestone: "0.6.0"
depends_on: ["app:DATA-012"]
last_updated: "2026-09-13"
---

## Summary

Make backup usable on the phone through file sharing and selection, with a clear replacement step before restore.

## Acceptance Criteria

- [ ] Settings exports JSON through the iOS share flow and selects a backup file for validation and restore through platform adapters.
- [ ] The restore flow explains that it replaces the ledger and excludes photos, identifies the validated backup, and requires an explicit replace action.
- [ ] Cancellation and invalid files leave data unchanged; errors retain a retry path and successful restore refreshes the visible app.
- [ ] Component tests cover cancellation and replacement. A recorded wiped iPhone restore verifies transactions, contact balances, unknowns, stored history, and home figures against the source.
