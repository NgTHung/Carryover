---
id: "UI-007"
title: "Shared UI primitives and motion"
status: In Progress
priority: "Medium"
type: "Feature"
milestone: "0.2.0"
depends_on: ["build:BUILD-002"]
risk: "Medium"
impact: "Keeps styling and animation consistent while containing the compatibility risk of new build tooling and native animation dependencies."
tags: ["ui", "design", "animation"]
last_updated: 2026-09-08
---

## Summary

Adopt stable NativeWind with a compatible Tailwind CSS and Tailwind Variants combination. Use Reanimated directly for motion and keep Hermes supplied by Expo and React Native. Build the small shared primitives needed by the first screens using docs/DESIGN.md. Follow docs/app-stack-and-testing.md; Moti and the NativeWind preview are deferred.

## Acceptance Criteria

- [ ] NativeWind, Tailwind CSS, Tailwind Variants, and any class-merging dependency form a compatible pinned set; the chosen versions and compatibility evidence are documented.
- [ ] Reanimated and Worklets use versions supported by the installed Expo SDK; the app keeps bundled Hermes and introduces no Moti dependency.
- [ ] Shared color, typography, and spacing tokens follow docs/DESIGN.md; buttons, inputs, and quality chips use typed variants instead of duplicated class strings.
- [ ] Motion uses shared Reanimated helpers and the platform reduced-motion preference, including the specified cross-fade fallback.
- [ ] Animations change presentation only; they never interpolate money amounts as floating point values or calculate budget figures.
- [ ] Existing SQL migration imports remain bundled after Metro and Babel changes; one representative screen passes local component checks, iOS bundling, and a CI native build with the widget excluded.
