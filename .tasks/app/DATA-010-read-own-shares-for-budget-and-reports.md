---
id: "DATA-010"
title: "Read own shares for budget and reports"
status: Done
priority: "High"
type: "Feature"
parent: "UI-004"
milestone: "0.3.0"
depends_on: ["BUDGET-001"]
risk: "High"
impact: "A shared read-only split path keeps the home snapshot and period reports consistent about own spending."
tags: ["budget", "reports"]
last_updated: 2026-09-12
---

## Summary

Read active split shares and reuse one pure own-expense resolver for budget and report consumers. This task does not add contacts, split writes, or settlements.

## Acceptance Criteria

- [x] Active share rows are read through a public data boundary with soft-deleted rows excluded.
- [x] Unsplit expenses count in full and split expenses count your contactId-null share only.
- [x] Invalid, duplicate, orphan, and non-exact share rows fail without producing a wrong total.
- [x] The committed budget input and the period report can consume the same share rows.
- [x] Logic and database tests cover non-half shares and all invalid-share cases.

## Verification

- `npm run test:logic -- --runInBand tests/budget.logic.test.ts tests/snapshot-source.logic.test.ts` passed 15 tests.
- `npm run test:database -- --runInBand tests/shares.database.test.ts` passed the active and soft-deleted share read case.
- `npm run typecheck` passed.
- No native dependency or migration was added. Split writes, contacts, and settlements remain owned by SPLIT-001.
