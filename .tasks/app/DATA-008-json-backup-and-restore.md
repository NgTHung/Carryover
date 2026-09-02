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
last_updated: 2026-09-02
---

## Summary

Stage 5, held at epic size. Sync across devices is deliberately out of scope for v1. Backup covers the risk that matters now.

Amounts stay integers through the JSON. A serializer that emits a float for an amount breaks invariant 1 in the one place tests rarely look, so the round trip needs an equality assertion on every amount rather than a spot check.

Photo export is optional and separate from the JSON, because roughly 48MB a year does not belong in a file you want to move around casually.

## Exit Criteria

- [ ] Export writes every table to JSON with amounts as integers.
- [ ] Restore rebuilds a wiped install, and every budget figure matches the source device.
- [ ] Bulk photo export is available and separate from the JSON export.
- [ ] A restore has been run on a wiped install before this milestone closes.
- [ ] The stage is split into Feature tasks before implementation starts.
