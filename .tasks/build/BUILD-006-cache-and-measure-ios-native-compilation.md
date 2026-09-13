---
id: "BUILD-006"
title: "Cache and measure iOS native compilation"
status: In Progress
priority: "High"
type: "TechDebt"
milestone: "0.1.0"
depends_on: ["build:BUILD-001"]
risk: "Medium"
tags: ["build", "ci"]
last_updated: 2026-09-13
---

## Summary

Each fresh macOS runner recompiles hundreds of native dependency files. Persist compiler results, install pods once, report build timings, and audit native dependencies by app variant so you can reduce build time without changing ledger or widget behavior.

## Acceptance Criteria

- [x] CI enables Ccache before pod installation, restores and saves its cache outside generated ios output, and separates incompatible toolchains and build variants.
- [x] Each build installs pods once and preserves native patch and entitlement handling.
- [x] Build logs and the job summary retain Xcode timing and per-build Ccache statistics, including when compilation fails.
- [x] The native dependency audit documents required widget storage dependencies and excludes development-only pods from release when safe, with variant checks.
- [x] Local workflow, configuration, typecheck, and test checks pass.
- [ ] GitHub Actions produces release and development IPAs and a second release build records cache hits and measured timing against the cold build.

## Verification

On September 13, 2026, TypeScript checking, all 249 Jest tests across 52 suites, and all 12 Python tests passed. Focused tests also passed after the final changes. Actionlint 1.7.12 and ShellCheck 0.11.0 passed for the workflow and new build scripts. The build harness verifies successful compilation, compiler exit code 65, saved stderr, cache statistics, and a failure before Xcode emits its timing summary.

Expo generated native projects in temporary directories for release, development, and release with the widget enabled. Release Podfiles include the development-module exclusions. The development Podfile retains default autolinking. All retain the template's USE_CCACHE support. Autolinking checks retain expo-widgets, @expo/ui, and expo-sqlite in release. Generation used --no-install on Linux; this does not verify CocoaPods installation, Xcode compilation, or device behavior.

The implementation is committed locally. CI timing and IPA verification remain open until the candidate is pushed with your consent. Build a candidate branch once for a cold release baseline, rerun after its cache saves, and dispatch development on that branch. Record run URLs, Xcode and total durations, cache transfer overhead, and cache hit counts here. Also verify the widget-enabled release still builds with the release exclusions.
