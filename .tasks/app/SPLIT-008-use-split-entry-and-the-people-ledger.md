---
id: "SPLIT-008"
title: "Use split entry and the People ledger"
status: "To Do"
priority: "Medium"
type: "Feature"
parent: "app:SPLIT-001"
milestone: "0.5.0"
depends_on: ["app:SPLIT-007", "app:CAPTURE-004"]
last_updated: "2026-09-13"
---

## Summary

Connect the tested split and settlement APIs to draft completion, transaction editing, and a People route.

## Acceptance Criteria

- [ ] Split entry has editable amount fields, a payer choice, inline contact creation, and Equally and Shares actions that leave fields editable using SPLIT-004.
- [ ] The form explains your receivable or what you owe, preserves valid input on failure, and follows the resolved boundary rules without a remainder repair step.
- [ ] People shows derived balances, contact history, and partial settlement controls for both directions; saved corrections refresh the list and Home.
- [ ] Component tests cover payer changes and partial settlement; an iPhone check verifies keyboard access, restart persistence, and the complete split-to-settlement flow.
