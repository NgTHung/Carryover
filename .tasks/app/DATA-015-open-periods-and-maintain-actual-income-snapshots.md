---
id: "DATA-015"
title: "Open periods and maintain actual income snapshots"
status: "To Do"
priority: "High"
type: "Feature"
milestone: "0.3.0"
depends_on: ["app:DATA-002", "app:DATA-004", "app:DATA-005", "app:DATA-009", "app:BUDGET-003"]
risk: "High"
impact: "First launch and income mutations must produce correct current figures without rewriting historical money totals."
last_updated: "2026-09-13"
---

## Summary

Implement docs/spec/period-income-policy.md before UI-020. Income has no fixed amount or arrival date. Open the current period, maintain its actual income total with ledger writes, and preserve past money totals. This task supersedes DATA-005's freeze-at-opening income policy; completed task evidence remains historical.

## Acceptance Criteria

- [ ] Document and test opening-balance and reserve derivation for first launch, an existing ledger opened midway through a period, and multiple periods away; distinguish opening money from current income without double counting, clamping, or inventing historical configuration.
- [ ] First launch reaches a ready snapshot without manually seeded month config. Startup, foreground refresh, and mutations across a local period boundary prepare the current period before publication; failures expose a retryable error.
- [ ] Period opening is idempotent under repeated or concurrent requests, preserves existing opening balance and reserved total, and defaults a new horizon to period end without assuming an income date.
- [ ] Current-period income total follows active known-amount income through create, edit, draft completion, soft deletion, direction changes, and date moves across periods; unknown amounts remain null and contribute no amount.
- [ ] Transaction changes and affected current income totals commit atomically through the shared data boundary. Failed or stale writes roll back both, emit no committed notification, and retries never double-count income.
- [ ] Past stored money totals remain unchanged by startup, rollover, upgrades, or historical transaction corrections. Corrections still affect actual ledger reports and current balances; moving income across periods updates only the current configuration.
- [ ] Income mutations preserve all horizons and opening or reserve snapshots. Reports read stored configuration alongside consistent ledger rows; current calendar baselines can change with current income while past configuration baselines stay frozen.
- [ ] Exact integer arithmetic and safe bounds cover aggregation and any opening-balance schema changes. Existing databases upgrade without rewriting historical totals, and snapshot computation remains owned by computeBudget.
- [ ] Real SQLite tests cover fresh and existing ledgers, first opening midway through a period, rollover after multiple periods away, rollback, concurrent writes, direction and date changes, unknown drafts, report refresh, and close-and-reopen persistence.
- [ ] Integration tests exercise native lifecycle wiring and the existing notifier-to-publisher path, including shared-storage failure after a committed income change; publication retry reads committed data without another transaction insert.
