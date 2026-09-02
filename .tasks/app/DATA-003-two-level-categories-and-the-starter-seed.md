---
id: "DATA-003"
title: "Two-level categories and the starter seed"
status: To Do
priority: "High"
type: "Feature"
milestone: "0.2.0"
depends_on: ["DATA-001"]
risk: "Medium"
impact: "The taxonomy shape is assumed by every report and by the fill-in screen. A third level appearing later would break aggregation at the group."
tags: ["data", "categories"]
last_updated: 2026-09-02
---

## Summary

Exactly two levels. A group has no parent and a leaf has a group parent. You log at a leaf and you report at a group. There is no third level and no arbitrary nesting, so the type should make a third level unrepresentable rather than merely discouraged.

A category is either `spend` or `reserve`. Rent and Bills seed as reserves, which is what pulls them out of discretionary money automatically.

The seed is built around real spending, with Coffee as its own group rather than a child of Food. Seeded rows are marked as suggestions so the whole set deletes in one action once real data says which leaves never get picked.

## Acceptance Criteria

- [ ] A category is a group with no parent or a leaf with a group parent, enforced by the type and by a test.
- [ ] Transactions reference a leaf and cannot reference a group.
- [ ] The starter seed from `docs/spec/carryover-v1.md` loads on first run, with Rent and Bills marked `reserve`.
- [ ] Seeded categories carry a suggestion flag and delete in one bulk action.
- [ ] A leaf with transactions soft-deletes and its transactions still read back with their category.
