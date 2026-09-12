---
id: "DATA-010"
title: "Read own shares for budget and reports"
status: "To Do"
priority: "High"
type: "Feature"
parent: "UI-004"
milestone: "0.3.0"
depends_on: ["BUDGET-001"]
risk: "High"
impact: "A shared read-only split path keeps the home snapshot and period reports consistent about own spending."
tags: ["budget", "reports"]
last_updated: "2026-09-12"
---

## Summary

Read active split shares and reuse one pure own-expense resolver for budget and report consumers. This task does not add contacts, split writes, or settlements.

## Acceptance Criteria

- [ ] Active share rows are read through a public data boundary with soft-deleted rows excluded.
- [ ] Unsplit expenses count in full and split expenses count your contactId-null share only.
- [ ] Invalid, duplicate, orphan, and non-exact share rows fail without producing a wrong total.
- [ ] The committed budget input and the period report can consume the same share rows.
- [ ] Logic and database tests cover non-half shares and all invalid-share cases.
