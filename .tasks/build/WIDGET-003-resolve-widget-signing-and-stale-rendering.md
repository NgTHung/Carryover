---
id: "WIDGET-003"
title: "Resolve widget signing and stale rendering"
status: "To Do"
priority: "High"
type: "Spike"
parent: "build:WIDGET-002"
milestone: "0.7.0"
depends_on: ["app:DATA-008", "build:WIDGET-001"]
last_updated: "2026-09-13"
---

## Summary

Resolve the existing device blocker before building the final widget. Use a test install or verified backup before any clean installation.

## Acceptance Criteria

- [ ] The planned paid membership and signing setup are available, and the selected App Group and bundle identifiers are recorded without signing secrets.
- [ ] A clean device installation demonstrates a visible widget code change, recording the revision, signing tool, and steps from the existing stale-render investigation.
- [ ] A diagnostic shared snapshot written by the app is read by the installed widget, proving the shared-container path on the iPhone.
- [ ] Widget-disabled builds keep working; unresolved signing or rendering failures remain explicit blockers and do not count as a completed spike.
