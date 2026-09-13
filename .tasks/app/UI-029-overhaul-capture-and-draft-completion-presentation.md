---
id: "UI-029"
title: "Overhaul capture and draft completion presentation"
status: "To Do"
priority: "Medium"
type: "Refactor"
parent: "app:UI-025"
milestone: "0.9.0"
depends_on: ["app:UI-027"]
last_updated: "2026-09-13"
---

## Summary

Refine the busiest input flow while preserving the tested capture and completion behavior.

## Acceptance Criteria

- [ ] Camera controls, optional amount entry, draft thumbnails, and completion follow the documented visual hierarchy.
- [ ] Searchable leaf selection, inline creation, optional quality, account choice, and split entry stay reachable with the keyboard open.
- [ ] Permission errors, unavailable photos, saving, cancellation, and retry use the shared feedback patterns without losing inputs or creating duplicate drafts.
- [ ] Existing capture and completion checks pass; iPhone review measures capture around two seconds and verifies larger text, keyboard avoidance, and reduced motion.
