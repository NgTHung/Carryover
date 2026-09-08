---
id: "UI-006"
title: "Expo Router navigation shell"
status: In Progress
priority: "High"
type: "Feature"
milestone: "0.2.0"
depends_on: ["DATA-001", "build:BUILD-002"]
risk: "Medium"
impact: "Gives screens one navigation owner and makes transaction links work without copying ledger data into route state."
tags: ["ui", "navigation"]
last_updated: 2026-09-08
---

## Summary

Use Expo Router for navigation, with thin route files under src/app and screen implementations outside the route directory. Expo Router owns route history and route parameters; Zustand owns shared UI state. Wire the root layout and a minimal reachable shell, then let each screen task add its routes. Follow docs/app-stack-and-testing.md.

## Acceptance Criteria

- [ ] Expo Router is installed at the version supported by the existing Expo SDK, typed routes are enabled, and the current startup flow moves behind the root layout.
- [ ] Database migrations complete before any route reads ledger data; migration loading and errors remain visible.
- [ ] Route files delegate to screen modules; domain logic, database setup, tests, and shared components stay outside src/app.
- [ ] Native stack navigation and direct links work for implemented routes, including a controlled response to an unknown route.
- [ ] Transaction routes carry identifiers and validate incoming parameters before reading through the public data API; no ledger row or amount is copied into route state.
- [ ] React Native Testing Library covers navigation and startup gating locally; Hermes and the default widget exclusion survive iOS bundling and the CI build.
