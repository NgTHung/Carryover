---
id: "UI-033"
title: "Fix account refresh recovery"
status: In Progress
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

- [ ] A committed opening-balance edit cannot be overwritten from stale account data after its refresh fails.
- [ ] A failed account refresh during initial loading shows a retryable error instead of leaving Accounts loading forever.
- [ ] Component tests reproduce both refresh failure sequences and pass with the fix.
