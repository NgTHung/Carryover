# Draft inbox verification

This record covers browsing active photo drafts across periods, recovering the
same transaction in the existing editor, and rebuilding the inbox after a
database restart. Local checks cover exact integer amounts, unknown drafts,
photo fallbacks, committed mutation refresh, period income maintenance,
rollback, snapshot retry, and file-backed recovery. Native fields remain
pending until the exact candidate runs on an iPhone.

Do not treat a Linux check or an iOS JavaScript export as device evidence. Use
one development IPA built from the tested implementation revision. Keep the
widget disabled for this run.

## Candidate identity

| Field | Result |
| --- | --- |
| Tested implementation revision | `acdf9c37c79727e4489a726975854d33f861ba98` |
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

Run the first-permission cases from a fresh development install. Use airplane
mode for offline cases. Record the candidate identity before each run.

| Scenario | Procedure | Expected result | Result |
| --- | --- | --- | --- |
| Both entry points | Open Drafts from Home, its unknown badge, and Transactions with filters active. | All routes show the same active drafts across periods; transaction filters stay unchanged. | PENDING |
| Known and unknown | Capture once with `45,001` and once with Skip amount; open Drafts. | Exact amount and Unknown amount stay distinct and both photos can load. | PENDING |
| Known-only inbox | Complete or delete the last unknown while retaining a known draft. | Home's unknown badge clears and the permanent Drafts action still opens the known draft. | PENDING |
| Partial save and completion | Open a draft, save incomplete changes, reopen, then supply amount and leaf. | The same row persists after partial save and disappears after completion; return lands in Drafts. | PENDING |
| Delete and cancel | Cancel deletion once, then confirm it. | Cancel preserves the draft; confirmation removes it and refreshes Home's count. | PENDING |
| Missing photo | Open a fixture with unavailable retained bytes. | Explicit fallback appears; reopening, completing, and deleting still work. | PENDING |
| Restart and offline | Capture known and unknown drafts, use airplane mode, force-quit, and reopen. | SQLite restores both rows and photo keys; Home publishes the correct unknown count. | PENDING |
| Navigation and lifecycle | Return from the editor, background and foreground the app, and repeat quick taps during a write. | No duplicate writes or stale restored rows; actions remain reachable. | PENDING |
| Display and scrolling | Browse a longer list with larger text and VoiceOver. | Amount states and actions remain readable; scrolling and safe areas preserve access. | PENDING |

Use injected failures in automated tests for deterministic database, snapshot,
and navigation failures. A device happy path does not prove those failure
cases.

## Local evidence

| Evidence | Result |
| --- | --- |
| Draft inbox database read boundary | PASS |
| Draft mutation and snapshot integration, 5 tests | PASS |
| File-backed restart recovery, 1 test | PASS |
| Draft inbox, route, Home, and editor components, 35 tests | PASS |
| Draft return real-router regression | PASS |
| Return-route parser, 5 tests | PASS |
| Full Jest gate, 113 suites and 608 tests | PASS |
| Python gate, 12 tests | PASS |
| TypeScript check | PASS |
| Web export | PASS |
| iOS JavaScript export | PASS |
| Taskroot validation, 87 tasks and 0 warnings | PASS |
| Git whitespace check | PASS |

The local gate was run at revision `acdf9c37c79727e4489a726975854d33f861ba98`:

```text
npm run typecheck
npm test -- --runInBand
python3 -m unittest discover -s tests -p '*_test.py'
npm run web:export
npx expo export --platform ios
taskroot validate
```

## Native evidence

Keep unrun fields as `PENDING`. Replace them only with observed values from
the IPA identified above. If a check fails, record the failure, candidate
revision, and follow-up commit before repeating it.

| Field | Result |
| --- | --- |
| Development workflow URL | PENDING |
| IPA artifact URL or name | PENDING |
| Device install and signing | PENDING |
| Both entry points and active filters | PENDING |
| Known and unknown amounts | PENDING |
| Known-only inbox | PENDING |
| Partial save and completion return | PENDING |
| Delete confirmation and cancel | PENDING |
| Missing-photo fallback | PENDING |
| Offline restart recovery | PENDING |
| Navigation and lifecycle | PENDING |
| Display, scrolling, and VoiceOver | PENDING |
| Failures and follow-up commits | PENDING |

There is no Mac, iOS simulator, IPA artifact, or attached iPhone in this
working environment. The native matrix is therefore intentionally unresolved,
and CAPTURE-005 remains In Progress until a device candidate is observed.
