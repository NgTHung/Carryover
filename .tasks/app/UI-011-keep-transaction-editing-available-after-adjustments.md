---
id: "UI-011"
title: "Keep transaction editing available after adjustments"
status: Done
priority: "High"
type: "Bug"
milestone: "0.2.0"
depends_on: ["UI-001"]
risk: "Medium"
impact: "An adjustment can make every transaction editor unavailable, and a failed filter-options request cannot recover from the visible retry action."
tags: ["ui", "transactions"]
last_updated: 2026-09-09
---

## Summary

Keep transaction editor account choices independent from balance calculation, and make transaction-list retry restore both rows and filter choices.

## Verification

- `npm test -- --runInBand` passes 28 suites and 127 tests.
- `npm run typecheck` passes.
- `npm run web:export` passes.

## Acceptance Criteria

- [x] Transaction routes load active account choices even when stored adjustments make balance projection unavailable.
- [x] Retry reloads both filtered rows and the unfiltered rows used for filter choices.
- [x] Focused tests cover adjustment-safe editor loading and full retry recovery.
