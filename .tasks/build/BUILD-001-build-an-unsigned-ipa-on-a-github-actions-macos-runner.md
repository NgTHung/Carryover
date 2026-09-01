---
id: "BUILD-001"
title: "Build an unsigned IPA on a GitHub Actions macOS runner"
status: In Progress
priority: "High"
type: "Feature"
milestone: "0.1.0"
risk: "Medium"
impact: "Establishes the only iOS build environment this project has. Every later stage depends on it, and a green build from the first commit means breakage is always traceable to one commit."
tags: ["build", "ios", "ci"]
last_updated: 2026-09-01
---

## Summary

There is no Mac in this toolchain, and every iOS binary must be compiled by Xcode on macOS. The workflow runs expo prebuild to generate the native project, installs pods, builds with signing disabled, wraps the app in Payload/, and uploads the IPA as an artifact. Signing happens on device at sideload time, which removes certificates, provisioning profiles, and App Store Connect keys from CI entirely. A Linux typecheck job runs first because macOS runner minutes bill at ten times the Linux rate.

## Acceptance Criteria

- [x] Pushing to any branch produces a downloadable unsigned IPA artifact.
- [x] The workflow contains no signing identity, provisioning profile, or repository secret.
- [x] The Xcode scheme is discovered from the generated workspace rather than hardcoded, so a rename does not break the build.
- [x] A Linux typecheck job runs before any macOS job starts.
- [x] docs/build/ios-unsigned-ipa.md explains the pipeline, the minute cost, and what free signing cannot do.
