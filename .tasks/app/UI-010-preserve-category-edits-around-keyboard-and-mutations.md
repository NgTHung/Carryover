---
id: "UI-010"
title: "Preserve category edits around keyboard and mutations"
status: In Progress
priority: "Medium"
type: "Bug"
milestone: "0.2.0"
depends_on: ["UI-002"]
risk: "Low"
impact: "Unsaved category names can disappear, and the iOS keyboard can cover controls at the bottom of the editor."
tags: ["ui", "categories"]
last_updated: 2026-09-09
---

## Summary

Keep an open category form intact while unrelated mutations reload data, and let the category editor adjust its scroll area around the iOS keyboard.

## Acceptance Criteria

- [ ] Changing group kind or category order does not close or clear an open form.
- [ ] The category editor adjusts its scroll insets for the iOS keyboard and supports interactive keyboard dismissal.
- [ ] Component tests cover preserved input and keyboard-aware scroll configuration.
