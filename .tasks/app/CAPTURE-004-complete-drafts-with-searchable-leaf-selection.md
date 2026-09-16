---
id: "CAPTURE-004"
title: "Complete drafts with searchable leaf selection"
status: Done
priority: "Medium"
type: "Feature"
parent: "app:CAPTURE-001"
milestone: "0.4.0"
depends_on: ["app:CAPTURE-003", "app:UI-002"]
last_updated: 2026-09-16
---

## Summary

Reuse transaction editing and category creation so you can complete a draft without leaving the flow.

## Execution Plan

Follow [the CAPTURE-004 execution plan](../../docs/plans/CAPTURE-004.md) for existing-code reuse, searchable leaf selection, inline creation, form preservation, photo display, atomic completion, retry boundaries, staged commits, and automated and iPhone verification.

## Acceptance Criteria

- [x] A draft shows its photo and completes with a positive amount and an active leaf for expense direction; income requires an amount and no category. Quality and changes to the captured account, date, and note remain optional. An unavailable photo does not block completion.
- [x] Leaf selection supports search and inline group or leaf creation through the existing two-level category API, preserving the draft input.
- [x] Completion uses the shared Zod and transaction boundary, including UI-020 future-local-date rejection and DATA-015 current income maintenance when direction changes. It keeps the same transaction id and photo key and refreshes unknown counts and the snapshot.
- [x] Component and database tests cover minimal completion, skipped quality, failed writes, inline category creation, and retry without duplicate transactions.

## Completion Evidence

Closed on 2026-09-16 at your request. The implementation reuses the transaction editor and manual transaction boundary, preserves draft identity and photo keys, supports searchable leaf selection and inline creation, and covers completion recovery and snapshot publication.

Local verification at revision 21d26f2 passed: TypeScript, all 107 Jest suites and 578 tests, all 12 Python tests, web export, iOS JavaScript export, and taskroot validation. Completion, category creation, rollback, snapshot, and file-backed restart coverage are recorded in [draft completion verification](../../docs/build/draft-completion.md).

The iPhone matrix remains PENDING. Closing this task records your requested lifecycle change and the verified implementation; it does not claim a native build or device pass.
