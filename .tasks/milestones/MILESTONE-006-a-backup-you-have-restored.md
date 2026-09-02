---
id: "MILESTONE-006"
title: "A backup you have restored"
status: To Do
priority: "Medium"
type: "Milestone"
milestone: "0.6.0"
last_updated: 2026-09-02
---

## Summary

Stage 5. JSON export and restore, with optional bulk photo export. Backup covers the risk that matters in v1, which is losing the phone. Multi-device sync stays out of scope.

A backup nobody has restored is not a backup, so the restore is exercised on a wiped install before the stage closes.

## Exit Criteria

- [ ] Export writes every table to JSON with amounts as integers.
- [ ] Restore rebuilds a wiped install and every budget figure matches the source device.
- [ ] A restore has actually been run on a wiped install, not just written.
- [ ] The stage is split into Feature tasks before implementation starts.
