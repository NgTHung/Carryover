---
id: "UI-019"
title: "Fix UI-005 review findings"
status: In Progress
priority: "High"
type: "Bug"
milestone: "0.3.0"
depends_on: ["UI-005"]
risk: "Medium"
impact: "Incorrect scrub coordinates can report the wrong day, hidden endpoint values weaken the chart without touch, and unknown drafts can look like zero-spend days."
tags: ["ui", "reports", "charts"]
last_updated: 2026-09-12
---

## Summary

Correct the cumulative pace interaction and make exact endpoint values and unknown calendar drafts visible without relying on a gesture or VoiceOver.

## Acceptance Criteria

- [ ] Scrubbing maps the full period chart geometry to the matching elapsed day and clamps future positions to the cutoff.
- [ ] The chart exposes exact current and reference values without requiring the scrub gesture, including in its accessibility label.
- [ ] Calendar cells with unknown drafts have a visible non-color marker and the legend explains it.
