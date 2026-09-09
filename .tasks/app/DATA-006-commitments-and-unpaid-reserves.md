---
id: "DATA-006"
title: "Commitments and unpaid reserves"
status: In Progress
priority: "High"
type: "Feature"
milestone: "0.3.0"
depends_on: ["DATA-003", "DATA-004"]
risk: "Medium"
impact: "Reserves are subtracted before anything is called discretionary. An over-counted reserve makes the app pessimistic, an under-counted one makes it lie."
tags: ["data", "commitments"]
last_updated: 2026-09-09
---

## Summary

Rent and bills are about 90% of outflow and they are spoken for from day one. A commitment holds a name, an amount, a due day, a reserve category, and an active flag.

Nothing is auto-created. Paying rent is a normal transaction you log against its reserve category, and reserved unpaid counts the commitments due this period that have no matching logged transaction yet. Auto-created transactions would put money in the ledger that never moved.

A complete expense pays at most one commitment with the same reserve category in the same period. The transaction amount may differ because the commitment is the amount reserved before the actual charge is known. Stable ordering makes duplicate commitments deterministic.

Commitments are live inputs for the current period. Historical reports keep reading the stored month config snapshot, so editing or deactivating a commitment never rewrites a past period.

A due day of 31 in a 30 day month resolves to the last day rather than rolling into the next month.

## Acceptance Criteria

- [ ] A commitment stores name, integer amount, due day 1 to 31, reserve category, and active flag.
- [ ] Zod validates commitment inputs with the shared positive money schema and integer due day bounds. The data layer verifies the reserve category, and tests reject invalid writes.
- [ ] A due day beyond the length of the month resolves to the last day of that month.
- [ ] Reserved unpaid sums active commitments due in the period after pairing each active, complete expense with at most one commitment in the same reserve category. Pairing is deterministic and does not require the transaction amount to equal the reserved amount.
- [ ] Paying a commitment is an ordinary transaction. No transaction is created automatically.
- [ ] An inactive commitment reserves nothing in live calculations, and commitment changes never rewrite a past period's stored month config.
