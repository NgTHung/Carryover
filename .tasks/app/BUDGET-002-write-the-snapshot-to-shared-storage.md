---
id: "BUDGET-002"
title: "Write the snapshot to shared storage on every mutation"
status: To Do
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["BUDGET-001", "build:WIDGET-001"]
risk: "Medium"
impact: "The only data path between the app and the widget. A stale snapshot is worse than no widget, because a wrong number on the home screen still looks authoritative."
tags: ["budget", "widget", "ios"]
last_updated: 2026-09-02
---

## Summary

Every mutation recomputes the snapshot and writes it to the shared App Group container. The home screen reads it and the widget reads it, so the two can never disagree.

WIDGET-001 landed the group resolution this depends on. The App Group is resolved at runtime from the binary's own embedded profile, because every sideloader rewrites the identifier and nothing rewrites the Info.plist key expo-widgets reads. Reuse that resolver rather than reading a configured constant.

`UserDefaults(suiteName:)` fails open and returns a process-local store when the entitlement is missing, so a round trip inside the app proves nothing about the shared container. `containerURL` fails closed and is the honest probe.

## Acceptance Criteria

- [ ] Every mutation that can change a budget figure recomputes the snapshot and writes it.
- [ ] The write uses the runtime-resolved App Group from build:WIDGET-001, not a configured constant.
- [ ] `updatedAt` on the written snapshot is the write time.
- [ ] A failed write surfaces an error rather than leaving a stale snapshot in place silently.
- [ ] The home screen reads the written snapshot, so both surfaces read one artifact.
