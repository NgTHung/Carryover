---
id: "CAPTURE-003"
title: "Capture a photo as a saved draft"
status: Done
priority: "Medium"
type: "Feature"
parent: "app:CAPTURE-001"
milestone: "0.4.0"
depends_on: ["app:CAPTURE-002"]
risk: "High"
impact: "Capture crosses the camera, app-local files, SQLite, and snapshot publication. A false success or duplicate retry makes the balance and unknown count untrustworthy."
last_updated: 2026-09-16
---

## Summary

Wire Home to camera capture with an optional amount. Reuse the current UI controls while making capture fast and reliable.

## Execution Plan

Follow [the CAPTURE-003 execution plan](../../docs/plans/CAPTURE-003.md) for the route-owned draft id, camera permissions, focused amount input, durable photo and SQLite sequence, idempotent retry, snapshot publication, staged commits, and iPhone verification. The local implementation and automated evidence are complete through Stage 5. On 2026-09-16, you requested completion with detailed checking deferred. The checklist records acceptance of the implemented work under that instruction, not new device evidence. Native verification remains pending in [the capture-draft runbook](../../docs/build/capture-draft.md).

## Acceptance Criteria

- [x] Capture opens the camera, takes a photo, offers a focused numeric keypad, and lets you skip the amount in one tap.
- [x] Success is reported only after the photo and SQLite draft are durable; skipping stores null and publishes an unknown through the existing snapshot path.
- [x] Expo Router owns the route and active draft id; cancellation, denied permission, backgrounding, and failed persistence do not report success or duplicate drafts.
- [x] Local database and component tests cover persistence and retry. The iPhone verification runbook is prepared; execution is deferred by your 2026-09-16 instruction.

## Deferred verification

Check permissions, keyboard behavior, offline capture, restart recovery, and capture time around two seconds on a CI-built iPhone candidate. Review the implementation details later as requested. Keep device results PENDING until observed; closing this task does not claim that these checks passed.
