---
id: "UI-033"
title: "Fix account refresh recovery"
status: Done
priority: "High"
type: "Bug"
milestone: "0.3.0"
depends_on: ["app:UI-024"]
risk: "High"
impact: "A failed account refresh can let a later edit overwrite a committed opening balance, or leave Accounts permanently loading."
tags: ["ui", "accounts"]
last_updated: 2026-09-15
---

## Summary

Keep account controls safe and retryable when an account read fails during or after a committed edit.

## Acceptance Criteria

- [x] A committed opening-balance edit cannot be overwritten from stale account data after its refresh fails.
- [x] A failed account refresh during initial loading shows a retryable error instead of leaving Accounts loading forever.
- [x] Component tests reproduce both refresh failure sequences and pass with the fix.

## Verification

Account controls become read-only after a refresh failure and return after a successful retry. A superseding notification read that fails during initial loading now reaches the existing retry screen.

- `npm test -- --runInBand`: passed, 75 suites and 394 tests.
- `npm run typecheck`: passed.
- `npx expo export --platform web`: passed.
- `npx expo export --platform ios`: passed, JavaScript bundle only.
- `taskroot validate`: passed with 0 warnings.
- `git diff --check`: passed.
- Device verification remains with BUILD-005.
