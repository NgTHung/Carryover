---
id: "SPLIT-004"
title: "Compute editable integer shares"
status: "To Do"
priority: "High"
type: "Feature"
parent: "app:SPLIT-001"
milestone: "0.5.0"
depends_on: ["app:SPLIT-002"]
last_updated: "2026-09-17"
---

## Summary

Put share arithmetic in pure functions that follow the resolved contract. The split form must not perform its own allocation.

## Acceptance Criteria

- [ ] Equal and weighted allocation produce positive safe-integer shares totaling the transaction amount, with division remainder assigned to the payer, or reject a zero-share result without changing the accepted allocation.
- [ ] Editing any share, including the payer share, or changing participants, payer, or amount follows the documented deterministic redistribution rules, including exact weighted divisibility for payer edits.
- [ ] All amount and weight arithmetic uses BigInt internally with safe bounds; invalid raw input leaves the last accepted allocation intact until correction or cancellation.
- [ ] Tests cover both payer kinds, uneven division, payer edits, weight changes, minimal amounts, unsafe bounds, and repeated identical inputs.
