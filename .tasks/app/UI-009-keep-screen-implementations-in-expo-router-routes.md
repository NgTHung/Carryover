---
id: "UI-009"
title: "Keep screen implementations in Expo Router routes"
status: In Progress
priority: "Medium"
type: "Refactor"
milestone: "0.2.0"
risk: "Low"
tags: ["ui"]
last_updated: 2026-09-09
---

## Summary

You can follow a route directly to its screen implementation in src/app. Remove the separate screens folder and keep reusable presentation components and route helpers in src/ui. This replaces the thin-route convention from UI-006 and UI-008 at the user request.

## Acceptance Criteria

- [ ] Route layouts and screen controllers live in src/app, with web variants beside their native fallback files and no src/screens folder.
- [ ] Shared presentation components and route helpers remain outside src/app; database, money, and budget boundaries remain separate.
- [ ] Existing tests and typechecking pass, and web and iOS exports preserve the migration gate and platform module boundaries.
- [ ] Architecture documentation and test imports describe the collapsed structure.
