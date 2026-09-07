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
last_updated: 2026-09-06
---

## Summary

After each committed mutation, one application service computes the snapshot and writes it to the shared App Group container. It then publishes that same snapshot to a Zustand store for the home screen. The widget reads the shared artifact. Keeping publication in one service prevents the two surfaces from using separate calculations; write failures remain visible. Follow `docs/state-and-validation.md`.

WIDGET-001 landed the group resolution this depends on. The App Group is resolved at runtime from the binary's own embedded profile, because every sideloader rewrites the identifier and nothing rewrites the Info.plist key expo-widgets reads. Reuse that resolver rather than reading a configured constant.

`UserDefaults(suiteName:)` fails open and returns a process-local store when the entitlement is missing, so a round trip inside the app proves nothing about the shared container. `containerURL` fails closed and is the honest probe.

## Acceptance Criteria

- [ ] Every mutation that can change a budget figure recomputes the snapshot and writes it.
- [ ] The write uses the runtime-resolved App Group from build:WIDGET-001, not a configured constant.
- [ ] `updatedAt` on the written snapshot is the write time.
- [ ] A failed write surfaces an error rather than leaving a stale snapshot in place silently.
- [ ] The home screen reads the written snapshot, so both surfaces read one artifact.
- [ ] A Zustand store exposes the published snapshot with explicit loading, ready, and error states. Store actions and selectors perform no budget arithmetic.
- [ ] Startup computes and writes a fresh snapshot from committed data before showing ready. A failed database mutation publishes no replacement; a failed shared-storage write exposes an error and supports retry from committed data.
- [ ] Tests assert that the ready store contains exactly the written snapshot and that publication failures cannot present a stale snapshot as current.
