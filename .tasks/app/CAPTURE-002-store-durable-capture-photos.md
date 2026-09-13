---
id: "CAPTURE-002"
title: "Store durable capture photos"
status: "To Do"
priority: "Medium"
type: "Feature"
parent: "app:CAPTURE-001"
milestone: "0.4.0"
depends_on: ["app:UI-020"]
last_updated: "2026-09-13"
---

## Summary

Keep photo files durable before linking them to a draft, because a temporary camera URI can disappear after restart.

## Acceptance Criteria

- [ ] A platform adapter downscales captures toward roughly 200KB, assigns stable photo keys, and stores them in persistent local storage.
- [ ] Capture cancellation and file or database failures have defined cleanup behavior; referenced photos remain available after restart and soft deletion.
- [ ] Photos stay outside routine JSON backup. Missing files produce an explicit unavailable thumbnail without changing draft amounts.
- [ ] Tests use deterministic fixtures for file failure and recovery; iPhone checks record retained photos and representative output sizes.
