---
id: "WIDGET-006"
title: "Apply the final visual design to the widget"
status: "To Do"
priority: "Medium"
type: "Refactor"
parent: "app:UI-025"
milestone: "0.9.0"
depends_on: ["app:UI-027", "build:WIDGET-005"]
last_updated: "2026-09-13"
---

## Summary

Match the widget to the final app design while keeping its separate runtime and proven snapshot path.

## Acceptance Criteria

- [ ] The small widget applies the documented hierarchy, typography, colors, unknown badge, and runway switch within widget layout limits.
- [ ] Large amounts and missing or stale snapshots stay readable, with no budget arithmetic or database access introduced.
- [ ] The widget does not import app styling, routing, animation, or state runtimes; shared visual values remain simple data.
- [ ] Fixture checks and a widget-enabled CI build pass; a real iPhone shows the current visual revision and matching Home figures.
