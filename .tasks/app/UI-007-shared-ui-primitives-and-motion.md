---
id: "UI-007"
title: "Shared UI primitives and motion"
status: In Progress
priority: "Medium"
type: "Feature"
milestone: "0.2.0"
depends_on: ["build:BUILD-002"]
risk: "Medium"
impact: "Keeps styling and animation consistent while containing the compatibility risk of new build tooling and native animation dependencies."
tags: ["ui", "design", "animation"]
last_updated: 2026-09-08
---

## Summary

Adopt stable NativeWind with a compatible Tailwind CSS and Tailwind Variants combination. Use Reanimated directly for motion and keep Hermes supplied by Expo and React Native. Build the small shared primitives needed by the first screens using docs/DESIGN.md. Follow docs/app-stack-and-testing.md; Moti and the NativeWind preview are deferred.

## Acceptance Criteria

- [x] NativeWind, Tailwind CSS, Tailwind Variants, and any class-merging dependency form a compatible pinned set; the chosen versions and compatibility evidence are documented.
- [x] Reanimated and Worklets use versions supported by the installed Expo SDK; the app keeps bundled Hermes and introduces no Moti dependency.
- [x] Shared color, typography, and spacing tokens follow docs/DESIGN.md; buttons, inputs, and quality chips use typed variants instead of duplicated class strings.
- [x] Motion uses shared Reanimated helpers and the platform reduced-motion preference, including the specified cross-fade fallback.
- [x] Animations change presentation only; they never interpolate money amounts as floating point values or calculate budget figures.
- [ ] Existing SQL migration imports remain bundled after Metro and Babel changes; one representative screen passes local component checks, iOS bundling, and a CI native build with the widget excluded.

## Verification

Completed locally on 2026-09-08:

- `npm ls --depth=2 nativewind tailwindcss tailwind-variants tailwind-merge react-native-reanimated react-native-worklets` resolves NativeWind 4.2.6, Tailwind CSS 3.4.19, Tailwind Variants 0.3.1, Tailwind Merge 2.5.4, Reanimated 4.5.1, and Worklets 0.10.1 with no invalid peers.
- `npm test -- --runInBand` passes 23 suites and 97 tests, including the shared primitive and cross-fade regression tests.
- `npm run typecheck`, `npx expo-doctor`, and `npm run web:export` pass.
- `npx expo export --platform ios` succeeds, and the exported bundle contains the SQL migration markers `CREATE TABLE` and `accounts_opening_balance_non_negative_vnd`.
- `CARRYOVER_WIDGET=0 npm run prebuild` succeeds on Linux with Hermes enabled and no widget target generated.

Cross-fade review completed on 2026-09-08:

- Outgoing content remains mounted until its opacity animation completes, with interaction and accessibility disabled.
- Tests control animation completion and cover cancellation, rapid key reuse, same-key updates, the 150ms reduced-motion hero transition, switching to instant motion, and cleanup after unmount.
- Typechecking and fresh web and iOS exports pass after the fix. SQL migrations remain bundled on iOS, and web bundles exclude SQLite and widget native module markers.
- The StrictMode regression passes and emits a Reanimated findNodeHandle deprecation warning. Native rendering still needs device verification.

The CI macOS native build with the widget excluded still needs to run on a pushed revision. This environment has no Mac, and the user has not authorized a push.
