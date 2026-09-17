---
id: "CAPTURE-005"
title: "Browse and recover photo drafts"
status: Done
priority: "Medium"
type: "Feature"
parent: "app:CAPTURE-001"
milestone: "0.4.0"
depends_on: ["app:CAPTURE-004"]
last_updated: 2026-09-17
---

## Summary

Give every saved draft a reachable route so captured purchases do not disappear from daily use.

## Execution Plan

Follow [the CAPTURE-005 execution plan](../../docs/plans/CAPTURE-005.md) for the active-draft read boundary, all-period inbox, known amounts and unknowns, photo fallbacks, Home and Transactions entry points, editor return navigation, committed refresh, snapshot and restart evidence, staged commits, and iPhone verification.

CAPTURE-004 is Done. Implementation and local verification are complete. The user directed this task to close on 2026-09-17 with native iPhone verification still pending in [the draft inbox verification record](../../docs/build/draft-inbox.md). The implementation reuses the existing editor for partial saves, completion, and confirmed soft deletion; notification scheduling remains in CAPTURE-006.

## Acceptance Criteria

- [x] Home and transaction navigation open an inbox of active drafts with thumbnails and links to completion.
- [x] Known draft amounts and unknowns remain distinct; an unavailable photo never hides its draft or substitutes a zero amount.
- [x] You can reopen, complete, or soft-delete a draft, with the inbox and home count refreshed after each mutation and restart.
- [x] Database and component tests cover mixed drafts, empty and error states, missing photos, deletion, and persisted recovery.
