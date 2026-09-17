---
id: "CAPTURE-001"
title: "Photo-first capture and the draft loop"
status: Done
priority: "Medium"
type: "Epic"
milestone: "0.4.0"
depends_on: ["UI-003"]
risk: "High"
impact: "Draft rot is the most likely way this app dies: forty unfilled captures and a remaining figure you no longer believe. The unknown badge and the nudge are core, not polish."
tags: ["capture", "drafts", "epic"]
last_updated: 2026-09-17
---

## Summary

Stage 3 completes capture before the UI overhaul. CAPTURE-002 through CAPTURE-006 cover photo storage, capture, completion, the inbox, and notifications. Daily use informs later changes but does not impose a waiting period.

Capture is a photo plus an optional amount on a pre-focused numpad, one tap to skip, closing in about two seconds. Completing a draft needs an amount and a leaf category and nothing else. Reuse shared controls and keep presentation changes for the later overhaul.

Test capture and draft persistence locally with Jest, real SQLite, and React Native Testing Library. Check camera permissions, photo library access, persistence across restart, and keyboard behavior on the iPhone after a CI build. Follow `docs/app-stack-and-testing.md` when splitting this stage.

## Deferred device verification

On 2026-09-17, you deferred iPhone checks until all features are implemented. build:BUILD-005 owns the native capture, completion, inbox, and reminder matrices, including capture timing and photo-size measurements. Device evidence remains pending and is required before release; it does not block continued feature implementation.

## Completion evidence

Closed on 2026-09-17 at your request. CAPTURE-002 through CAPTURE-006 are Done and record the implementation and local test evidence. The checked criteria record acceptance of that work with device verification deferred to build:BUILD-005. Closure does not establish an iPhone pass, measured capture speed, or measured native photo sizes.

## Exit Criteria

- [x] Capture is a photo plus an optional amount. Verification of the roughly two-second capture target belongs to build:BUILD-005.
- [x] Photos are downscaled at capture toward roughly 200KB, kept indefinitely, and excluded from routine JSON backup. Native size measurements belong to build:BUILD-005.
- [x] The draft inbox lists unfinished captures with thumbnails.
- [x] Capture and completion reuse DATA-004 Zod schemas. Skipping the amount persists null, preserving an unknown after restart.
- [x] Expo Router owns capture routes and the active draft id; Zustand holds only shared capture UI state not represented by those routes. Captured drafts are saved to SQLite before capture is reported as successful and survive an app restart.
- [x] The fill-in screen completes a draft with an amount and a leaf, creating categories inline through the UI-002 module.
- [x] A daily local notification nudges while unknowns exist.
- [x] Capture and draft-completion transitions use the shared Reanimated helpers and reduced-motion behavior without changing stored amounts or computing budget figures.
- [x] Local database and component tests cover skipping an amount, persisted draft recovery, and completion using deterministic photo fixtures. Real capture, restart persistence, keyboard, and permission checks are assigned to build:BUILD-005 after feature implementation and before release.
- [x] The stage is split into Feature tasks before implementation starts.
