---
id: "CAPTURE-005"
title: "Browse and recover photo drafts"
status: "To Do"
priority: "Medium"
type: "Feature"
parent: "app:CAPTURE-001"
milestone: "0.4.0"
depends_on: ["app:CAPTURE-004"]
last_updated: "2026-09-13"
---

## Summary

Give every saved draft a reachable route so captured purchases do not disappear from daily use.

## Acceptance Criteria

- [ ] Home and transaction navigation open an inbox of active drafts with thumbnails and links to completion.
- [ ] Known draft amounts and unknowns remain distinct; an unavailable photo never hides its draft or substitutes a zero amount.
- [ ] You can reopen, complete, or soft-delete a draft, with the inbox and home count refreshed after each mutation and restart.
- [ ] Database and component tests cover mixed drafts, empty and error states, missing photos, deletion, and persisted recovery.
