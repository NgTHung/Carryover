---
id: "CAPTURE-001"
title: "Photo-first capture and the draft loop"
status: To Do
priority: "Medium"
type: "Epic"
milestone: "0.4.0"
depends_on: ["UI-003", "build:BUILD-003"]
risk: "High"
impact: "Draft rot is the most likely way this app dies: forty unfilled captures and a remaining figure you no longer believe. The unknown badge and the nudge are core, not polish."
tags: ["capture", "drafts", "epic"]
last_updated: 2026-09-07
---

## Summary

Stage 3, held at epic size on purpose. Capture is designed after two months of real data from stage 2, because the categories and the fill-in fields will change once you have used the numbers daily.

The shape is settled even though the tasks are not. Capture is a photo plus an optional amount on a pre-focused numpad, one tap to skip, closing in about two seconds. Completing a draft needs an amount and a leaf category and nothing else, because a form here produces forty unfilled drafts.

Test the capture flow locally with Jest and React Native Testing Library, then extend the on-demand Maestro suite. Camera permissions, photo library access, and keyboard behavior still need an iPhone check after a CI build. Follow `docs/app-stack-and-testing.md` when splitting this stage.

## Exit Criteria

- [ ] Capture is a photo plus an optional amount and closes in about two seconds.
- [ ] Photos are downscaled at capture to roughly 200KB, kept indefinitely, and excluded from backup.
- [ ] The draft inbox lists unfinished captures with thumbnails.
- [ ] Capture and completion reuse DATA-004 Zod schemas. Skipping the amount persists null, preserving an unknown after restart.
- [ ] Expo Router owns capture routes and the active draft id; Zustand holds only shared capture UI state not represented by those routes. Captured drafts are saved to SQLite before capture is reported as successful and survive an app restart.
- [ ] The fill-in screen completes a draft with an amount and a leaf, creating categories inline through the UI-002 module.
- [ ] A daily local notification nudges while unknowns exist.
- [ ] Capture and draft-completion transitions use the shared Reanimated helpers and reduced-motion behavior without changing stored amounts or computing budget figures.
- [ ] Local component tests cover skipping an amount and completing a draft; Maestro covers persisted draft recovery and completion using deterministic photo fixtures. Real camera and permission behavior are checked on the iPhone before release.
- [ ] The stage is split into Feature tasks before implementation starts.
