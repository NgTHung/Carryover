---
id: "CAPTURE-006"
title: "Nudge while unknown drafts exist"
status: "To Do"
priority: "Medium"
type: "Feature"
parent: "app:CAPTURE-001"
milestone: "0.4.0"
depends_on: ["app:CAPTURE-005"]
last_updated: "2026-09-13"
---

## Summary

Use one daily local notification to remind you about unknowns without requiring notification access to capture.

## Acceptance Criteria

- [ ] Permission is requested in context and denial leaves capture and completion usable.
- [ ] At most one daily nudge is scheduled while unknowns exist; completion or deletion of the last unknown cancels it.
- [ ] Startup and foreground refresh reconcile notification state, and tapping the notification opens the draft inbox.
- [ ] Adapter tests cover scheduling, cancellation, duplicates, and permission errors; the iPhone check verifies delivery and navigation.
