---
id: "WIDGET-002"
title: "The widget reading the snapshot"
status: To Do
priority: "Medium"
type: "Epic"
milestone: "0.7.0"
depends_on: ["WIDGET-001", "app:BUDGET-002"]
risk: "High"
impact: "The last stage, and the one with a known unresolved failure. If the extension still renders stale code from a clean device, the problem is in the install layer and the paid membership will not fix it."
tags: ["widget", "ios", "epic"]
last_updated: 2026-09-02
---

## Summary

Stage 6, held at epic size until BUDGET-002 is writing snapshots. Buy the paid membership here. It unlocks App Groups, push, and TestFlight together, and WIDGET-001 already showed the free path works well enough that nothing earlier is blocked on it.

WIDGET-001 left one question open. The extension installed, appeared in the gallery, and executed, but two visual changes never appeared on device across several builds and two signers. That points at the extension running stale code rather than at the group plumbing. Retry from a clean device before touching widget code: remove the widget, delete the app, reboot, reinstall.

The widget renders per day and the unknown badge, and swaps to runway when runway drops below days to horizon. It reads the snapshot and never queries the database, because it has no database to query.

## Exit Criteria

- [ ] The paid Apple Developer membership is active.
- [ ] A code change to the widget appears on device, closing the stale-render question from WIDGET-001.
- [ ] The small widget renders per day and the unknown badge from the snapshot.
- [ ] The widget swaps to runway when runway drops below days to horizon.
- [ ] The widget reads only the snapshot and holds no budget arithmetic of its own.
- [ ] The stage is split into Feature tasks before implementation starts.
