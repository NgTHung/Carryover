---
id: "BUILD-005"
title: "Verify all v1 functionality on the iPhone"
status: "To Do"
priority: "High"
type: "TestDebt"
milestone: "0.8.0"
depends_on: ["build:BUILD-004", "app:UI-020", "app:UI-021", "app:UI-022", "app:UI-023", "app:UI-024", "app:CAPTURE-001", "app:SPLIT-001", "app:DATA-008", "build:WIDGET-002"]
last_updated: "2026-09-17"
---

## Summary

Use a repeatable manual candidate checklist to prove the whole app works before presentation changes. Keep BUILD-003 deferred.

## Deferred capture verification

On 2026-09-17, you chose to run iPhone checks after all features are implemented. This task owns the outstanding native checks for CAPTURE-002 through CAPTURE-006. Use the matrices in docs/build/capture-photo-storage.md, docs/build/capture-draft.md, docs/build/draft-completion.md, docs/build/draft-inbox.md, and docs/build/draft-nudge.md. Keep every unobserved result PENDING until you test an identified CI-built candidate. Feature-task closure does not establish a device pass.

## Acceptance Criteria

- [ ] Record a passing candidate revision for local tests, typechecking, Expo diagnostics, web export, and the GitHub Actions unsigned iOS build.
- [ ] The iPhone checklist covers manual expense and income, accounts and reconcile, transfers, commitments, horizon changes, categories, editable history and reports, capture, splits, settlements, backup and restore, and the widget.
- [ ] Verify offline use, restart persistence, cancelled actions, permission denial, unknown drafts, period rollover, and snapshot refresh; map all nine invariants to passing tests.
- [ ] Verify DATA-015 first launch without seeded month config, returning after multiple periods away, irregular income with no payday, current income corrections, and frozen past money totals. Manual transactions reject future local dates, future horizons remain editable, and income leaves the horizon unchanged.
- [ ] Verify a committed transaction survives publication failure and retry without duplication, with keyboard access, safe areas, and larger text covered on the manual creation form.
- [ ] Reconcile milestone 0.1.0 through 0.7.0 checklists with build and device evidence. File and resolve discovered functional defects before completion; presentation findings feed the later UI overhaul.

- [ ] Complete the deferred capture matrices: photo size and retention, capture timing around two seconds, permissions, keyboard behavior, offline and restart recovery, completion, and inbox navigation.
- [ ] Complete the daily reminder matrix on a CI-built iPhone candidate: contextual permission and denial, one daily request, last-unknown cancellation, foreground reconciliation, offline delivery, warm and cold taps opening Drafts, and pending-editor navigation. Record the build revision and device results.
