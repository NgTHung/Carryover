---
id: "MILESTONE-007"
title: "Widget on the home screen"
status: To Do
priority: "Medium"
type: "Milestone"
milestone: "0.7.0"
last_updated: 2026-09-13
---

## Summary

Stage 6. The paid Apple Developer membership and the widget that renders the snapshot. WIDGET-001 already settled that a sideloaded IPA carries a widget extension and that App Groups are reachable on a free account. What it did not settle is why the extension rendered stale code, so this stage retries from a clean device before touching widget code.

## Exit Criteria

- [ ] The widget renders per day and the unknown badge from the snapshot on a real phone.
- [ ] The widget reads the snapshot and never queries the database.
- [ ] A widget code change appears on a clean test installation, closing the stale-render failure recorded in build:WIDGET-001.
- [ ] WIDGET-005 records snapshot refresh and lifecycle checks on the iPhone.
- [x] The stage is split into a device spike, a Feature task, and refresh verification before implementation starts.
