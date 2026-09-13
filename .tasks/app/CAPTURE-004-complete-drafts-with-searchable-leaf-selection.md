---
id: "CAPTURE-004"
title: "Complete drafts with searchable leaf selection"
status: "To Do"
priority: "Medium"
type: "Feature"
parent: "app:CAPTURE-001"
milestone: "0.4.0"
depends_on: ["app:CAPTURE-003", "app:UI-002"]
last_updated: "2026-09-13"
---

## Summary

Reuse transaction editing and category creation so you can complete a draft without leaving the flow.

## Acceptance Criteria

- [ ] A draft shows its photo and completes with only a positive amount and a leaf; quality, account, date, and note remain optional.
- [ ] Leaf selection supports search and inline group or leaf creation through the existing two-level category API, preserving the draft input.
- [ ] Completion uses the existing Zod and transaction boundary, keeps the same transaction id and photo key, and refreshes unknown counts and the snapshot.
- [ ] Component and database tests cover minimal completion, skipped quality, failed writes, inline category creation, and retry without duplicate transactions.
