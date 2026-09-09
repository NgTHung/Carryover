---
id: "UI-001"
title: "Transaction list with filters"
status: Done
priority: "Medium"
type: "Feature"
milestone: "0.2.0"
depends_on: ["DATA-004", "UI-006", "UI-007"]
risk: "Low"
impact: "The only way to see whether the ledger is right before the budget engine exists."
tags: ["ui", "transactions"]
last_updated: 2026-09-09
---

## Summary

A list of transactions with filters by period, category, account, and quality. This is the screen that proves stage 1 works, because until the engine lands there is no other view of what was stored.

Adjustments and transfers appear here even though no report counts them. Drift stays honest only if you can see it.

Introduce Zustand for the selected period and transaction filters shared across screens. Components subscribe with selectors. SQLite supplies the transaction rows through the data layer, and screen-local input stays in React state. Follow `docs/state-and-validation.md`.

## Implementation Notes

- The list lives at `/transactions`; the Stage Zero root links to it until UI-003 replaces the home screen.
- Period selects one local calendar month. Category, account, and quality each select one value or all, and every active filter combines with AND semantics.
- Transfers from the transfer ledger appear as read-only rows. Manual transaction and transfer creation remain outside this task.
- The transaction route edits amount, direction, leaf or income source, account, quality, date, and note. It preserves photo and payer metadata without exposing capture or split controls.
- Draft edits preserve an unknown amount as null. A draft completes only when its direction-specific required fields are present.

## Acceptance Criteria

- [x] The list shows amount, leaf category, account, quality, and date for each transaction.
- [x] Filters by period, category, account, and quality combine rather than replace each other.
- [x] Zustand owns the shared selected period and filters, retains them across screen navigation, and supports an explicit reset. It stores no transaction collection or computed money totals.
- [x] The list refreshes after committed creates, edits, completions, and soft deletes, including writes from another screen.
- [x] Adjustments and transfers are visible and visually distinct from spending.
- [x] Drafts appear with their unknown amount shown as unknown, not as zero.
- [x] Tapping a transaction opens it for editing.
- [x] The editor saves supported fields, completes valid drafts atomically, and soft-deletes through the public data API. Transfer rows remain read-only.
- [x] Expo Router opens a transaction by id, and the screen loads it through the public data API. A missing or deleted transaction has an explicit unavailable state.
- [x] The screen reuses UI-007 primitives. React Native Testing Library covers combined filters, unknown amounts, and opening a transaction without a native build.

## Verification

- `npm test -- --runInBand` passes 28 suites and 125 tests.
- `npm run typecheck` passes.
- `npm run web:export` passes with an explicit ledger-unavailable browser route.
- `CARRYOVER_WIDGET=0 npm run prebuild` and `CARRYOVER_WIDGET=0 npx expo export --platform ios` pass.
- `npm run doctor` reports only the four pre-existing Expo SDK patch mismatches.
