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
last_updated: 2026-09-14
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

The first candidate runs succeeded: release https://github.com/NgTHung/Carryover/actions/runs/34759109838 and development https://github.com/NgTHung/Carryover/actions/runs/34759109568. Release Xcode compilation took 11m05s and development took 11m34s. Each installed pods once and produced its IPA and diagnostic artifacts. Release reduced CompileC tasks from 514 to 502. Both caches reported zero files, reads, writes, hits, and misses despite compiler wrapper invocations in the logs. These runs do not establish a speed improvement, and rerunning their empty caches would not measure reuse.

The follow-up makes the cache environment and executable paths explicit in generated compiler wrappers, disables Clang explicit modules as advised by Xcode for unrecognized compilers, and starts cache keys at v2. The Python harness executes both wrappers with an empty environment and a cache path containing spaces. Focused Python tests, ShellCheck, and Actionlint pass. The new CI runs must confirm that compiler results reach the saved directory before a second release build measures cache hits. Widget-enabled release verification also remains open. You authorized candidate-branch pushes and requested that the agent queue builds without waiting for completion.

The corrected cold builds succeeded on commit 6d96910. Release run https://github.com/NgTHung/Carryover/actions/runs/34760114672 took 8m45s in Xcode and 11m38s overall. Ccache recorded 502 cacheable misses, 1004 writes, and 1506 stored files using 48.02% of its 1 GB limit. Saving the cache took 5 seconds. Development run https://github.com/NgTHung/Carryover/actions/runs/34760114570 took 12m17s in Xcode and 16m00s overall. It recorded 514 cacheable misses, 1028 writes, and 1542 files using 54.52% of the limit; saving took 6 seconds. Both had zero hits because their v2 caches were new. Five preprocessing calls per build were uncacheable. These results confirm that compiler results reach the persisted directory, but do not yet measure reuse.

On September 14, both corrected runs were rerun against the same commit to measure cache reuse. Their second attempts are pending. Do not dispatch the widget build on this branch until the release rerun completes because the two share a concurrency group.
