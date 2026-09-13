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
last_updated: 2026-09-13
---

## Summary

Prioritize an unsigned iOS development build that connects to the local Expo server for device-accurate Fast Refresh. Give it a separate bundle identifier, visible name, and development URL scheme so you can keep your release ledger separate from test data. Keep the release identity and widget opt-in stable.

Keep the browser preview limited to startup and shared layout work until product screens exist. Its current stage 0 screen shows that native diagnostics are unavailable. Future screens should share components with iOS and receive typed fixtures. The browser never opens the ledger because expo-sqlite web support is alpha and browser persistence cannot prove native SQLite behavior.

Publish separate development and release sources in the AltStore JSON format so your compatible on-device signer can discover and download new builds. Use public GitHub Release assets, preserve app identities, and derive source metadata from the packaged IPA. This distribution work belongs to BUILD-004 at your request.

## Acceptance Criteria

- [x] The local browser preview starts through a documented npm command and loads the app without importing unavailable iOS widget APIs.
- [x] The browser path does not open the ledger or imply that browser persistence verifies native SQLite behavior; its visible preview state makes that boundary clear.
- [x] Development configuration uses a separate bundle identifier, visible name, and URL scheme; CI and the documented Metro command select the same variant and keep its widget disabled.
- [ ] The signed development app installs beside the release app, opens from Metro, and keeps test transactions separate from the release ledger.
- [x] An on-demand GitHub Actions job packages an unsigned iOS development IPA with Expo development-client support and keeps the widget disabled.
- [ ] TypeScript and JavaScript changes refresh from the local Expo server without rebuilding the native app; native dependency and app configuration changes are documented as rebuild boundaries.
- [x] The existing release IPA build remains unchanged and all local tests, typechecking, Expo diagnostics, and a production web export pass.
- [ ] Successful default-branch builds publish separate development and release source URLs with IPA metadata, unique build numbers, and direct downloads. Branch and widget experiment builds remain artifacts only.
- [x] Source generation and publication checks pass locally, and documentation explains source import, update signing, and preservation of app identity and data.
- [ ] The published source imports in your signer and a subsequent build installs as an update while preserving the ledger.

## Verification

Local verification passed on 2026-09-08. The web development server rendered the preview without a SQLite or widget runtime error. The production web bundle excludes `openDatabaseSync`, `wa-sqlite`, and `ExpoWidgets`. All 66 tests, strict typechecking, all 21 Expo diagnostics, the production web export, prebuild, and workflow linting passed. Prebuild generated the development-client bundle URL and no widget target.

Development isolation verification on 2026-09-08 passed all 71 tests, strict typechecking, all 21 Expo diagnostics, and the production web export. Temporary development and release prebuilds generated distinct bundle identifiers and URL schemes. Development generated no widget target even with the widget opt-in set. The default release configuration matches the previous version exactly. Metro served the development identity and emitted a carryover-dev launch URL. Workflow linting passed after excluding the installed linter's outdated macos-26 runner-label warning.

The on-demand development workflow passed on 2026-09-13 at https://github.com/NgTHung/Carryover/actions/runs/34732966354. Its Debug device build produced the `carryover-development-ipa` artifact. The packaged payload contains `CarryoverDev.app` with the development bundle identifier, display name, URL scheme, and Expo development launcher. It contains no widget extension.

Current local verification on 2026-09-13 passed a clean dependency install, all 243 tests, strict typechecking, all 21 Expo diagnostics, and the production web export. Development and release prebuilds kept their distinct bundle identifiers, URL schemes, and App Groups, with one application target and no widget target. Metro served a development manifest with the same development identity. The default release path also passed GitHub Actions after variant isolation was added. SDK 57 patch dependencies were aligned because current Expo diagnostics no longer accepted the older resolved versions.

The standalone React Native DevTools app could not start because this Linux machine lacks libnspr4.so. Metro still started and served the development manifest successfully.

Signer source implementation on 2026-09-13 passed all 244 app tests, 10 Python distribution tests, strict typechecking, all 21 Expo diagnostics, the production web export, and actionlint 1.7.12. Temporary development and release prebuilds both wrote version 0.1.0 and build 42.2 to the native Info.plist. Distribution tests cover binary metadata, identity mismatches, widget exclusion, failed uploads, old-run downgrade prevention, corrupt existing metadata, and publication retries that reuse the successful build's assets. No dependencies or signing credentials were added.

The workflow publishes separate AltStore-format sources from successful default-branch builds through public GitHub Releases. Sources and IPA URLs are documented in docs/build/ios-unsigned-ipa.md. These changes are committed locally; initial CI publication and source import on the iPhone remain unverified until the commits are pushed and both channels build. Keep the publication and device criteria open until those checks pass.

Signed iPhone checks remain required. Verify both apps install together, Metro opens the development app, TypeScript and JavaScript edits refresh without rebuilding, and development transactions do not change the release ledger. Pushing requires explicit user consent.
