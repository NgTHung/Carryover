---
id: "UI-008"
title: "Consolidate screen and navigation folders"
status: Done
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

- [x] src has six top-level folders: app, screens, ui, data, money, and budget; route files remain thin.
- [x] Root layout and migration status live under screens; transaction route modules live under screens/transactions; Stage Zero routes and diagnostics live under screens/diagnostics; HomeRouteLink lives under ui.
- [x] Imports, test mocks, and architecture documentation use the new paths without changing application behavior or the native and web boundaries.
- [x] Typechecking, existing tests, and web and iOS exports pass; SQL migration markers remain present in the iOS bundle.

## Verification

Completed locally on 2026-09-08:

- The refactor leaves six top-level source folders. Git detects the moves as renames with import changes.
- Typechecking and all 22 test suites pass, with 90 tests.
- Web and iOS exports pass. The iOS Hermes bundle includes the SQL migration markers. Web bundles exclude the SQLite and widget native module markers.
- Current source, tests, and documentation have no references to the removed navigation and dev paths.

Native CI verification remains pending until a pushed revision is built on macOS.
