---
id: "UI-027"
title: "Rework shared visual tokens and controls"
status: "To Do"
priority: "Medium"
type: "Refactor"
parent: "app:UI-025"
milestone: "0.9.0"
depends_on: ["app:UI-026"]
last_updated: "2026-09-13"
---

## Summary

Apply the chosen design to shared primitives so screen changes do not create separate visual systems.

## Acceptance Criteria

- [ ] Color, type, spacing, surfaces, and control states use one app token source and shared typed variants.
- [ ] Buttons, inputs, selection controls, feedback, and motion support the documented theme behavior, larger text, focus, disabled states, and reduced motion.
- [ ] Fixture previews expose common control states without querying the browser ledger; new shared components keep modules within repository size guidance.
- [ ] Typechecking, existing component tests, and web export pass; add behavior tests only when control interactions change.
