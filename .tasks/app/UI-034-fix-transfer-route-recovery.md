---
id: "UI-034"
title: "Fix transfer route recovery"
status: Done
priority: "Medium"
type: "Bug"
milestone: "0.3.0"
depends_on: ["app:UI-023"]
risk: "Medium"
impact: "Stale account and route state can submit an unavailable transfer or show details for the wrong link, while successful saves can duplicate Accounts in navigation history."
tags: ["ui", "accounts"]
last_updated: 2026-09-15
---

## Summary

Correct transfer creation and detail navigation after the UI-023 review.

## Acceptance Criteria

- [x] Successful creation returns to the existing Accounts route without leaving duplicate Accounts screens in history.
- [x] Account refreshes replace stale account choices and block transfer submission when a selected account becomes unavailable.
- [x] Transfer detail ignores obsolete reads after its route parameter changes, including changes to an invalid link.
- [x] Component tests cover all three recovery cases.

## Verification Evidence

- `npm test -- --runInBand`: 85 suites passed, 433 tests passed.
- `npm run typecheck`: passed.
- `npx expo export --platform web`: passed.
- `npx expo export --platform ios`: passed JavaScript bundling. Native compilation was not run locally.
- `git diff --check` and `taskroot validate`: passed.
