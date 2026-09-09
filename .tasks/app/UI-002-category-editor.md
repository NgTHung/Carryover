---
id: "UI-002"
title: "Category editor"
status: In Progress
priority: "Medium"
type: "Feature"
milestone: "0.2.0"
depends_on: ["DATA-003", "UI-006", "UI-007"]
risk: "Low"
impact: "Category sprawl is a predicted failure mode. Pruning has to be as easy as creating, or the list grows to forty entries with six in use."
tags: ["ui", "categories"]
last_updated: 2026-09-09
---

## Summary

The Settings screen for groups and leaves: create, rename, reorder, mark a group as reserve, and delete. Inline creation from the fill-in screen arrives in stage 3 and shares this module rather than duplicating it.

Prune hard at the end of month one, once real data says which leaves never got picked. That is why bulk deletion of the seed matters more than getting the seed perfect.

## Implementation Notes

- The editor lives at `/settings/categories` and uses Move up and Move down controls instead of adding a drag-and-drop dependency.
- `categoryData.createCategory` remains the shared creation boundary for this screen and the future fill-in screen. An omitted `sort` appends atomically; explicit `sort` stays supported for existing callers.
- Reordering writes deterministic integer `sort` values for one sibling scope at a time.
- Group kind changes cascade to the group's leaves. Deletion is a soft delete; deleting a group soft-deletes its active leaves while preserving historical references.
- The native route injects SQLite data. The web route has no SQLite import and renders a preview-only state.

## Acceptance Criteria

- [ ] Groups and leaves are creatable, renamable, and reorderable by `sort`.
- [ ] A group can be marked `spend` or `reserve`.
- [ ] The seeded suggestions delete in one action from this screen.
- [ ] Creating a category returns the same module the fill-in screen will call, with no duplicated logic.
- [ ] The editor refuses to nest a leaf under a leaf.
- [ ] The Settings route uses Expo Router and shared UI-007 primitives. Local React Native Testing Library tests cover creation, validation feedback, and deletion.
