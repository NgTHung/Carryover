---
id: "BUDGET-003"
title: "Keep published snapshots valid and fresh"
status: Done
priority: "High"
type: "Bug"
milestone: "0.3.0"
depends_on: ["BUDGET-002"]
risk: "High"
impact: "Nullable budget figures can fail native publication, diagnostics can replace current data, and an app left mounted can show yesterday’s snapshot."
tags: ["budget", "widget", "ios"]
last_updated: 2026-09-13
---

## Summary

Preserve nullable budget values through shared storage, keep diagnostics from writing an alternate artifact, and refresh the snapshot whenever the native app returns to the foreground.

Follow-up ownership, 2026-09-13: DATA-015 extends startup and foreground refresh with period preparation, including returning after several periods away. These completed freshness checks do not yet prove period creation or rollover. See docs/spec/period-income-policy.md.

## Acceptance Criteria

- [x] Nullable snapshot values survive shared storage and render as unavailable instead of failing publication.
- [x] Diagnostics cannot overwrite the published snapshot outside the publication service.
- [x] Returning to the foreground recomputes the snapshot from committed data and the current date.
- [x] Tests cover nullable storage values, diagnostic publication, and foreground refresh.
