---
id: "UI-003"
title: "Home screen reading the snapshot"
status: Done
priority: "High"
type: "Feature"
milestone: "0.3.0"
depends_on: ["BUDGET-002", "UI-006", "UI-007"]
risk: "Medium"
impact: "The screen that decides whether the app gets trusted. If it computes anything itself it can disagree with the widget."
tags: ["ui", "budget"]
last_updated: 2026-09-11
---

## Summary

Per day is the large figure. The carryover balance and runway sit beneath it. The unknown badge shows when unfilled drafts exist, because a remaining figure with two unlogged purchases behind it is optimistic and should say so.

The screen renders snapshot fields. It does no arithmetic of its own, including no rounding and no division, so that what you read here is what the widget reads.

## Acceptance Criteria

- [x] Per day is the largest figure on the screen.
- [x] Carryover balance and runway render beneath it.
- [x] The unknown badge shows the count of drafts with no amount and hides at zero.
- [x] The receivable total shows beside discretionary when it is non-zero.
- [x] The screen reads snapshot fields and performs no budget arithmetic.
- [x] The screen subscribes to the BUDGET-002 Zustand snapshot store with selectors and renders its loading or error state without substituting zero figures.
- [x] The capture button is present and reachable with one thumb.
- [x] The route and controls reuse UI-006 and UI-007. Reanimated changes presentation only and respects reduced motion without computing or mutating money figures.
- [x] Local React Native Testing Library tests cover snapshot loading, errors, unknown counts, and ready values; rendering never substitutes zero for unavailable data.

## Verification

- `npm test -- --runInBand` passed 44 suites and 213 tests on 2026-09-11.
- `npm run typecheck` passed on 2026-09-11.
- `npx expo export --platform web` passed and produced the home browser preview without ledger access on 2026-09-11.
- `npx expo export --platform ios` passed and produced the Hermes bundle on 2026-09-11.
- `npm run doctor` reports the repository's existing Expo SDK patch-version drift; UI-003 adds no dependencies or version changes.
- Device-only safe-area, Dynamic Type, VoiceOver, and reduced-motion checks remain part of the iOS release checklist.
