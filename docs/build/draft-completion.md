# Draft completion verification

This record covers completing a retained photo draft through the existing
transaction boundary. Local checks cover identity preservation, integer money,
period income maintenance, snapshot publication, rollback, and restart
persistence. Native fields remain pending until the exact candidate runs on an
iPhone.

Do not treat a green Linux check or an iOS JavaScript export as device evidence.
Use one development IPA built from the tested implementation revision. Keep
the widget disabled for this run.

## Candidate identity

| Field | Result |
| --- | --- |
| Tested implementation revision | `71be74c29bc8526e99ebd838227929ffaed64e31` |
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
| Minimal completion | Capture with Skip amount, open its Transactions row, enter `45,001` and choose a spend leaf. Leave optional fields untouched. | The retained photo is visible, quality stays unset, account and date stay unchanged, and one row completes. | PENDING |
| Known amount | Capture `45,001`, reopen, and choose a leaf without changing the amount. | The amount is exact and spending is not charged twice. | PENDING |
| Inline creation | Enter optional fields, search a missing leaf, create a group and then a leaf, and complete. | Transaction input survives and the new leaf is selected. | PENDING |
| Search | Search group and leaf names with accents, without accents, and with no match, then clear the query. | Results follow the matching rules and selected leaf identity stays stable. | PENDING |
| Keyboard and text size | Use amount, search, and creation fields with normal and larger text. | Keyboard, safe areas, scrolling, focus, Create, Complete, and cancel actions stay usable. | PENDING |
| Missing photo | Open a draft whose retained file is unavailable. | The explicit photo fallback appears and valid completion remains available. | PENDING |
| Invalid input | Try zero, fractional amount, and tomorrow's local date. | Clear feedback appears and the stored draft stays unchanged. | PENDING |
| Direction | Change a current expense draft to income and complete with an amount. | Category is cleared and current income and the snapshot agree with the ledger. | PENDING |
| Offline and restart | Complete in airplane mode, force-quit, and reopen the transaction route. | The same complete transaction, amount, retained photo, and optional values survive. | PENDING |
| Rapid input and lifecycle | Tap Complete repeatedly and attempt back or background while saving. | One completion commits and the route cannot start a second write after success. | PENDING |

Use injected failures in automated tests for deterministic SQL, category-read,
navigation, and snapshot failures. A device happy path does not prove those
failure cases. Detailed camera and capture-timing checks remain in the
CAPTURE-003 runbook.

## Local evidence

The completion boundary and snapshot tests use migrated SQLite and the real
manual transaction facade:

| Evidence | Result |
| --- | --- |
| Draft completion boundary and form validation | PASS |
| Search, category creation, photo, editor, and route regressions | PASS |
| Identity recovery and navigation failure coverage | PASS |
| Snapshot integration, rollback, income changes, and publication retry | PASS |
| File-backed completion close and reopen | PASS |
| TypeScript check | PASS |
| Jest gate, 107 suites and 578 tests | PASS |
| Python gate, 12 tests | PASS |
| Web export | PASS |
| iOS JavaScript export | PASS |
| Full local gate | PASS |

The local gate is:

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
| Minimal completion | PENDING |
| Known amount | PENDING |
| Inline creation and preserved input | PENDING |
| Search and accent matching | PENDING |
| Keyboard, safe area, and larger text | PENDING |
| Missing-photo fallback | PENDING |
| Invalid input feedback | PENDING |
| Direction and current income | PENDING |
| Offline completion and restart | PENDING |
| Rapid input and lifecycle | PENDING |
| Failures and follow-up commits | PENDING |

CAPTURE-004 was marked Done on 2026-09-16 at your request. The local gate was
rerun successfully at revision 21d26f2: 107 Jest suites and 578 tests, 12 Python
tests, TypeScript, web export, iOS JavaScript export, and taskroot validation.
The native matrix remains PENDING. Task closure does not establish an iPhone
pass or change the candidate identity above.
