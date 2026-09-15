---
id: "CAPTURE-002"
title: "Store durable capture photos"
status: Done
priority: "Medium"
type: "Feature"
parent: "app:CAPTURE-001"
milestone: "0.4.0"
depends_on: ["app:UI-020"]
last_updated: 2026-09-15
---

## Summary

Keep photo files durable before linking them to a draft, because a temporary camera URI can disappear after restart.

## Execution Plan

Follow [the CAPTURE-002 execution plan](../../docs/plans/CAPTURE-002.md) for stable keys, bounded compression, file ownership, cancellation and failure recovery, thumbnail behavior, and staged commits. The native iPhone verification is explicitly deferred to `build:BUILD-005`; this task records the completed local implementation and automated evidence without claiming device results.

## Acceptance Criteria

- [x] A platform adapter downscales captures toward roughly 200KB, assigns stable photo keys, and stores them in persistent local storage. Native-device measurement is deferred to `build:BUILD-005`.
- [x] Capture cancellation and file or database failures have defined cleanup behavior; referenced photos remain available after restart and soft deletion.
- [x] Photos stay outside routine JSON backup. Missing files produce an explicit unavailable thumbnail without changing draft amounts.
- [x] Tests use deterministic fixtures for file failure and recovery. The deferred iPhone checks and representative output-size measurements are tracked by `build:BUILD-005`.

## Deferred Verification

The CI-built iPhone storage probe, native permission/build evidence, and representative output-size measurements remain pending by explicit decision. They must be completed through `build:BUILD-005` before release; this task does not claim that device verification passed.
