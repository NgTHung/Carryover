---
id: "BUILD-004"
title: "Local UI preview and iOS Fast Refresh"
status: In Progress
priority: "Medium"
type: "Feature"
milestone: "0.2.0"
depends_on: ["BUILD-002"]
risk: "Medium"
impact: "Shortens UI iteration from one macOS build per edit to immediate local refresh while keeping a real iPhone path for iOS-only behavior."
tags: ["build", "ui", "ios"]
last_updated: 2026-09-08
---

## Summary

Add two development-only feedback loops. A browser preview runs on the local machine for routine screen and style work. It uses explicit preview data instead of the ledger because expo-sqlite web support is alpha and the SDK 57 synchronous API cannot open reliably during module evaluation. A separately packaged unsigned iOS development build connects to the local Expo server for device-accurate Fast Refresh. The release workflow and widget opt-in remain unchanged.

## Acceptance Criteria

- [ ] The local browser preview starts through a documented npm command and loads the app without importing unavailable iOS widget APIs.
- [ ] The browser path does not open the ledger or imply that browser persistence verifies native SQLite behavior; its visible preview state makes that boundary clear.
- [ ] An on-demand GitHub Actions job packages an unsigned iOS development IPA with Expo development-client support and keeps the widget disabled.
- [ ] TypeScript and JavaScript changes refresh from the local Expo server without rebuilding the native app; native dependency and app configuration changes are documented as rebuild boundaries.
- [ ] The existing release IPA build remains unchanged and all local tests, typechecking, Expo diagnostics, and a production web export pass.
