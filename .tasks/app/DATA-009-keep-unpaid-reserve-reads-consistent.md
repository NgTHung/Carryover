---
id: "DATA-009"
title: "Keep unpaid reserve reads consistent"
status: In Progress
priority: "High"
type: "Bug"
milestone: "0.3.0"
depends_on: ["DATA-006"]
risk: "Medium"
impact: "A mixed commitment and payment view can publish an unpaid reserve total that never existed, which makes discretionary wrong."
tags: ["data", "commitments"]
last_updated: 2026-09-09
---

## Summary

Read the commitments and matching payment transactions used by reserved unpaid from one SQLite statement so concurrent ledger edits cannot combine different database versions.

## Acceptance Criteria

- [ ] Reserved unpaid reads commitments and matching payment transactions from one consistent database view.
- [ ] A regression test overlaps category edits with the read and proves the result matches one real ledger state.
