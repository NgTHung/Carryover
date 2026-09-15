---
id: "UI-024"
title: "Edit bank and cash account details"
status: Done
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["app:DATA-002", "app:DATA-007", "app:DATA-015"]
last_updated: 2026-09-15
---

## Summary

Complete the account controls around the two fixed accounts. Reuse reconcile for corrections after setup.

## Execution Plan

Follow [the UI-024 execution plan](../../docs/plans/UI-024.md) for the validated account edit API, form behavior, period preparation, commit stages, and verification. Planning leaves this task To Do.

## Acceptance Criteria

- [x] You can edit account names and opening balances through the validated account data API, extended to save both fields atomically, while preserving bank and cash identities and the bank default.
- [x] Opening balance editing explains its historical effect; routine balance correction remains reachable through reconcile.
- [x] Account edits refresh affected reads and the snapshot through DATA-015 period preparation without recomputing stored opening or reserve snapshots. Changing an account opening balance changes the live ledger projection, not actual income or past configuration money totals.
- [x] Database and component tests cover integer money, invalid input, cancelled edits, and consistency with reconcile.

## Verification

The data boundary, shared account form, route refresh, transaction account choices, transaction labels, reconcile path, period preparation, and notification-driven snapshot publication are covered by the focused and full test suites.

- `npm test -- --runInBand`: passed, 75 suites and 393 tests.
- `npm run typecheck`: passed.
- `npx expo export --platform web`: passed.
- `npx expo export --platform ios`: passed, JavaScript bundle only.
- `taskroot validate`: passed with 0 warnings.
- `git diff --check`: passed.
- Device verification remains outstanding. No iPhone or macOS native build runner was available in this workspace, so UI-024 does not claim physical-device or native-build evidence. BUILD-005 retains the release-wide iPhone check.
