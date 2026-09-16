# Saved capture draft verification

This runbook records the native verification for CAPTURE-003. Local tests and
JavaScript exports prove the route, persistence boundary, retry behavior, and
snapshot integration. They do not prove camera permissions, keyboard and safe
area behavior, lifecycle behavior, native photo retention, or capture timing.

Use the exact development IPA built from the tested revision. Keep all device
fields as `PENDING` until they are observed on an iPhone. Do not treat a green
Linux check, an iOS JavaScript export, or a successful prebuild as device
evidence.

## Candidate identity

| Field | Result |
| --- | --- |
| Tested revision | PENDING |
| GitHub Actions workflow URL | PENDING |
| IPA artifact | PENDING |
| Development build number | PENDING |
| IPA installed and signed | PENDING |
| iPhone model | PENDING |
| iOS version | PENDING |
| Metro connection | PENDING |
| Widget | Disabled |

Build the development variant with the widget disabled through the existing
[unsigned IPA workflow](ios-unsigned-ipa.md). Install that exact candidate as
Carryover Dev, then use `npm run start:device` when the development build needs
Metro. Keep the release app and its data separate.

## Device matrix

Run the first-permission cases from a fresh development install. Run the other
cases against the same candidate revision. Use airplane mode for offline cases.

| Scenario | Procedure | Pass condition | Result |
| --- | --- | --- | --- |
| Permission allow | Open Capture, allow camera access, and wait for readiness. | One back-camera preview opens, the configured explanation appears once, and no photo-library prompt appears. | PENDING |
| Permission deny and recovery | Deny access, retry where allowed, enable it in Settings, and return. | No photo or draft is created while denied. The route explains recovery and opens after permission is granted. | PENDING |
| Keyboard and safe area | Capture with normal and larger text settings, then use Done and Skip. | The numeric keypad is focused. Shutter, Skip, Done, and dismiss remain visible and tappable. | PENDING |
| Unknown offline capture | Take a receipt photo, choose Skip amount, and return Home. | One durable unknown appears. No network UI is required. | PENDING |
| Known offline capture | Capture `45,001` VND while offline. | The draft stores exactly `45,001` and the snapshot changes by exactly that amount without adding an unknown. | PENDING |
| Cancel and retry | Cancel before shutter and after shutter. Exercise a failed photo or database boundary, then retry. | Cancellation reports no success. Retry creates one draft with one route id. | PENDING |
| Background and foreground | Background in live view, after shutter, and during Done or Skip. | No duplicate preview or success appears. Committed work returns Home once. | PENDING |
| Duplicate input | Tap shutter and Done or Skip repeatedly while work is pending. | One retained photo and one transaction id exist. Unknown count changes at most once. | PENDING |
| Restart recovery | Force-quit after an unknown save and reopen. Repeat immediately after save if possible. | The draft and unknown count survive, and reopening cannot insert a second row. | PENDING |
| Snapshot failure recovery | Use the existing shared-storage failure probe if available. | The committed draft remains. Retrying publication does not repeat capture persistence. | PENDING |

Inspect every retained sample for readable receipt text and correct
orientation. Record failures with the candidate revision and a follow-up
commit. Correctness failures block completion even when timing passes.

## Timing evidence

Measure at least ten warm, airplane-mode Skip amount captures. Record camera
ready separately from shutter-to-Home. The target is a warm shutter-to-Home
median at or below two seconds. Include the slowest result so a fast median
does not hide a lifecycle or storage stall.

| Measurement | Sample count | Median | Slowest | Result |
| --- | ---: | ---: | ---: | --- |
| Home Capture tap to camera ready | PENDING | PENDING | PENDING | PENDING |
| Shutter tap to Home return | PENDING | PENDING | PENDING | PENDING |
| Photo preparation | PENDING | PENDING | PENDING | PENDING |
| Retain and SQLite commit | PENDING | PENDING | PENDING | PENDING |

## Local evidence

The local evidence for this stage is kept in the capture test suites:

- `tests/capture.component.test.tsx` covers permission, camera readiness,
  frozen review, amount actions, duplicate locks, cancellation, and retries.
- `tests/capture-route.component.test.tsx` covers invalid, new, saved, and
  colliding route ids before camera access.
- `tests/capture-snapshot.integration.database.test.ts` covers exact known
  spending, explicit unknowns, writer identity, rejected mutation, and
  publication retry.
- `tests/captured-draft-restart.database.test.ts` covers close/reopen recovery
  with a recreated retained-photo store.

The local gate is listed in
[the CAPTURE-003 execution plan](../plans/CAPTURE-003.md). You requested CAPTURE-003 be marked Done on 2026-09-16 with detailed checking
deferred. The native matrix remains pending and must still be run and recorded
here. Task closure is not evidence of a device pass.
