---
id: "UI-009"
title: "Keep screen implementations in Expo Router routes"
status: Done
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

- [x] Route layouts and screen controllers live in src/app, with web variants beside their native fallback files and no src/screens folder.
- [x] Shared presentation components and route helpers remain outside src/app; database, money, and budget boundaries remain separate.
- [x] Existing tests and typechecking pass, and web and iOS exports preserve the migration gate and platform module boundaries.
- [x] Architecture documentation and test imports describe the collapsed structure.

## Verification

- All 24 test suites and 106 tests pass. The route tests still prove that migrations gate ledger reads.
- Typechecking and web and iOS exports pass. The iOS export uses Hermes.
- The web bundle excludes ExpoSQLite, wa-sqlite, ExpoWidgets, and SQL table creation markers. The iOS bundle retains SQLite and migration markers.
- Native database imports live behind src/ui/ledger-access because route discovery bundles fallback route files on web. Its web replacement refuses ledger calls.
- Current source, tests, README, and architecture documentation contain no src/screens references. Historical task files retain their completed scope.
- The existing StrictMode findNodeHandle warning remains in the CrossFade tests. A macOS IPA build was not run locally.
