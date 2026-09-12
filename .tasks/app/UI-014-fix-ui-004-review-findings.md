---
id: "UI-014"
title: "Fix UI-004 review findings"
status: Done
priority: "High"
type: "Bug"
milestone: "0.3.0"
depends_on: ["UI-004"]
risk: "High"
impact: "Orphaned active share reads can stop the home snapshot after a split transaction is deleted, while amount-only chart labels leave quality segments dependent on color."
tags: ["ui", "reports"]
last_updated: 2026-09-12
---

## Summary

Keep shared split reads aligned with active transactions and identify every direct quality segment label in text.

## Acceptance Criteria

- [x] Normal share reads exclude rows whose transaction is soft-deleted, while audit reads can still include them.
- [x] Deleting a split transaction cannot make budget own-share resolution fail.
- [x] Every visible direct quality segment label includes the quality name and amount.

## Verification

- `npm test -- --runInBand` passed 48 suites and 229 tests.
- `npm run typecheck` passed.
- `npm run web:export` passed.
