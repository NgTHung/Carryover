---
id: "SPLIT-004"
title: "Compute editable integer shares"
status: "To Do"
priority: "High"
type: "Feature"
parent: "app:SPLIT-001"
milestone: "0.5.0"
depends_on: ["app:SPLIT-002"]
last_updated: "2026-09-13"
---

## Summary

Put share arithmetic in pure functions that follow the resolved contract. The split form must not perform its own allocation.

## Acceptance Criteria

- [ ] Equal and weighted allocation produce positive integer shares totaling the transaction amount, with division remainder assigned to the payer.
- [ ] Editing any share, including the payer share, or changing participants, payer, or amount follows the documented deterministic redistribution rules.
- [ ] All amount arithmetic uses integer operations and safe bounds; rejected input leaves the last valid allocation intact.
- [ ] Tests cover both payer kinds, uneven division, payer edits, weight changes, minimal amounts, unsafe bounds, and repeated identical inputs.
