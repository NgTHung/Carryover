---
id: "UI-002"
title: "Category editor"
status: To Do
priority: "Medium"
type: "Feature"
milestone: "0.2.0"
depends_on: ["DATA-003"]
risk: "Low"
impact: "Category sprawl is a predicted failure mode. Pruning has to be as easy as creating, or the list grows to forty entries with six in use."
tags: ["ui", "categories"]
last_updated: 2026-09-02
---

## Summary

The Settings screen for groups and leaves: create, rename, reorder, mark a group as reserve, and delete. Inline creation from the fill-in screen arrives in stage 3 and shares this module rather than duplicating it.

Prune hard at the end of month one, once real data says which leaves never got picked. That is why bulk deletion of the seed matters more than getting the seed perfect.

## Acceptance Criteria

- [ ] Groups and leaves are creatable, renamable, and reorderable by `sort`.
- [ ] A group can be marked `spend` or `reserve`.
- [ ] The seeded suggestions delete in one action from this screen.
- [ ] Creating a category returns the same module the fill-in screen will call, with no duplicated logic.
- [ ] The editor refuses to nest a leaf under a leaf.
