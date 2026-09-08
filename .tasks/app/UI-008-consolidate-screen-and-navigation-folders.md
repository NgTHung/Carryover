---
id: "UI-008"
title: "Consolidate screen and navigation folders"
status: In Progress
priority: "Medium"
type: "Refactor"
milestone: "0.2.0"
risk: "Low"
tags: ["ui"]
last_updated: 2026-09-08
---

## Summary

Keep related screen code together so you can follow startup and transaction routes without crossing navigation, screens, and dev folders. Preserve the separate data, money, budget, and shared UI boundaries.

## Acceptance Criteria

- [ ] src has six top-level folders: app, screens, ui, data, money, and budget; route files remain thin.
- [ ] Root layout and migration status live under screens; transaction route modules live under screens/transactions; Stage Zero routes and diagnostics live under screens/diagnostics; HomeRouteLink lives under ui.
- [ ] Imports, test mocks, and architecture documentation use the new paths without changing application behavior or the native and web boundaries.
- [ ] Typechecking, existing tests, and web and iOS exports pass; SQL migration markers remain present in the iOS bundle.
