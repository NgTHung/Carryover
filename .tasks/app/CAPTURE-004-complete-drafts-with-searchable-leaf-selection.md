---
id: "CAPTURE-004"
title: "Complete drafts with searchable leaf selection"
status: "To Do"
priority: "Medium"
type: "Feature"
parent: "app:CAPTURE-001"
milestone: "0.4.0"
depends_on: ["app:CAPTURE-003", "app:UI-002"]
last_updated: "2026-09-16"
---

## Summary

Reuse transaction editing and category creation so you can complete a draft without leaving the flow.

## Execution Plan

Follow [the CAPTURE-004 execution plan](../../docs/plans/CAPTURE-004.md) for existing-code reuse, searchable leaf selection, inline creation, form preservation, photo display, atomic completion, retry boundaries, staged commits, and automated and iPhone verification. This task remains To Do until implementation starts.

## Acceptance Criteria

- [ ] A draft shows its photo and completes with a positive amount and an active leaf for expense direction; income requires an amount and no category. Quality and changes to the captured account, date, and note remain optional. An unavailable photo does not block completion.
- [ ] Leaf selection supports search and inline group or leaf creation through the existing two-level category API, preserving the draft input.
- [ ] Completion uses the shared Zod and transaction boundary, including UI-020 future-local-date rejection and DATA-015 current income maintenance when direction changes. It keeps the same transaction id and photo key and refreshes unknown counts and the snapshot.
- [ ] Component and database tests cover minimal completion, skipped quality, failed writes, inline category creation, and retry without duplicate transactions.
