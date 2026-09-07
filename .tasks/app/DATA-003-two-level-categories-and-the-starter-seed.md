---
id: "DATA-003"
title: "Two-level categories and the starter seed"
status: In Progress
priority: "High"
type: "Feature"
milestone: "0.2.0"
depends_on: ["DATA-001"]
risk: "Medium"
impact: "The taxonomy shape is assumed by every report and by the fill-in screen. A third level appearing later would break aggregation at the group."
tags: ["data", "categories"]
last_updated: 2026-09-07
---

## Summary

Exactly two levels. A group has no parent and a leaf has a group parent. You log at a leaf and you report at a group. There is no third level and no arbitrary nesting, so the type should make a third level unrepresentable rather than merely discouraged.

A category is either `spend` or `reserve`. Rent and Bills seed as reserves, which is what pulls them out of discretionary money automatically.

The seed is built around real spending, with Coffee as its own group rather than a child of Food. Seeded rows are marked as suggestions so the whole set deletes in one action once real data says which leaves never get picked.

This task owns the category contracts, active-leaf validation, historical category references, and suggestion deletion. DATA-004 owns transaction CRUD and must call the active-leaf validator before writing a category reference. If a user-created leaf uses a suggested group, suggestion deletion keeps that group and clears its suggestion flag before removing the remaining suggestions.

## Acceptance Criteria

- [x] A category domain value is either a group with no group reference or a leaf carrying a typed group reference, enforced by the type and by a test.
- [x] Zod validates category input shape; the data layer checks that a selected parent exists and is an active group before writing.
- [x] The category data boundary exposes a shared active-leaf validator that rejects missing, deleted, and group category IDs. DATA-004 owns calling it from transaction writes.
- [x] The starter seed from `docs/spec/carryover-v1.md` loads on first run, with Rent and Bills marked `reserve`.
- [ ] Seeded categories carry a suggestion flag and delete in one bulk action. A suggested group with an active user-created leaf is retained as a normal group so no active leaf loses its group, including when leaf creation and suggestion deletion overlap.
- [x] A leaf with transactions soft-deletes, and an explicit historical category-reference read still resolves that leaf and its group for the transaction.
