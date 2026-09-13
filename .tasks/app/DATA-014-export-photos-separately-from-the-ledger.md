---
id: "DATA-014"
title: "Export photos separately from the ledger"
status: "To Do"
priority: "Medium"
type: "Feature"
parent: "app:DATA-008"
milestone: "0.6.0"
depends_on: ["app:DATA-011", "app:CAPTURE-002"]
last_updated: "2026-09-13"
---

## Summary

Let you keep a separate copy of retained photos without enlarging routine JSON backups.

## Acceptance Criteria

- [ ] Settings offers optional bulk photo export separately from JSON, preserving stable photo keys in file names or a manifest.
- [ ] Large collections are processed without loading all image bytes into memory; cancellation and failure never delete retained originals.
- [ ] Missing files are reported with their keys, and photos retained for soft-deleted transactions follow the same export policy.
- [ ] Adapter tests cover key mapping and partial failure; an iPhone check verifies a shared export can be opened and matched to ledger photo keys.
