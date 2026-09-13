---
id: "UI-032"
title: "Verify the overhaul on the iPhone"
status: "To Do"
priority: "Medium"
type: "TestDebt"
parent: "app:UI-025"
milestone: "0.9.0"
depends_on: ["app:UI-028", "app:UI-029", "app:UI-030", "app:UI-031", "build:WIDGET-006"]
last_updated: "2026-09-13"
---

## Summary

Close the overhaul with device evidence because browser previews cannot establish iPhone layout or interaction quality.

## Acceptance Criteria

- [ ] Record the reviewed candidate and representative screens in each supported theme, with empty, dense, error, unknown, and large-money states.
- [ ] Check VoiceOver order and labels, Dynamic Type, contrast, touch targets, safe areas, keyboard avoidance, reduced motion, and chart alternatives; resolve failures before completion.
- [ ] Repeat BUILD-005 functional scenarios on the redesigned candidate, including capture timing, history edits, settlements, restore, and Home-widget agreement.
- [ ] Local checks and the required unsigned iOS builds pass; remaining presentation defects are fixed and design documentation matches the installed interface.
