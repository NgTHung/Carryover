---
id: "SPLIT-002"
title: "Define split and settlement boundary cases"
status: "To Do"
priority: "High"
type: "Design"
parent: "app:SPLIT-001"
milestone: "0.5.0"
depends_on: ["app:CAPTURE-001"]
last_updated: "2026-09-13"
---

## Summary

Resolve the existing split form promise against positive integer money before implementing arithmetic. Record examples in the split contract in docs/DESIGN.md.

## Acceptance Criteria

- [ ] Examples define empty, fractional, excessive, and unsafe input, too many participants for positive shares, payer changes, and editing the payer field.
- [ ] The contract explains how every accepted split sums exactly and how integer division remainder reaches the payer without silently accepting invalid money.
- [ ] Examples define contact-paid transactions, opposite debts, partial settlements, deterministic oldest-first ties, overpayment, and edits or deletions after settlement.
- [ ] The contract defines account and snapshot effects while preserving the existing rule that settlements never change budget figures or become income; any incompatible promise is resolved in the task criteria before code.
