---
id: "DATA-006"
title: "Commitments and unpaid reserves"
status: To Do
priority: "High"
type: "Feature"
milestone: "0.3.0"
depends_on: ["DATA-003", "DATA-004"]
risk: "Medium"
impact: "Reserves are subtracted before anything is called discretionary. An over-counted reserve makes the app pessimistic, an under-counted one makes it lie."
tags: ["data", "commitments"]
last_updated: 2026-09-02
---

## Summary

Rent and bills are about 90% of outflow and they are spoken for from day one. A commitment holds a name, an amount, a due day, a reserve category, and an active flag.

Nothing is auto-created. Paying rent is a normal transaction you log against its reserve category, and reserved unpaid counts the commitments due this period that have no matching logged transaction yet. Auto-created transactions would put money in the ledger that never moved.

A due day of 31 in a 30 day month resolves to the last day rather than rolling into the next month.

## Acceptance Criteria

- [ ] A commitment stores name, integer amount, due day 1 to 31, reserve category, and active flag.
- [ ] A due day beyond the length of the month resolves to the last day of that month.
- [ ] Reserved unpaid counts active commitments due in the period with no matching logged transaction.
- [ ] Paying a commitment is an ordinary transaction. No transaction is created automatically.
- [ ] An inactive commitment reserves nothing and leaves past periods untouched.
