# Daily draft reminder verification

This record covers the local reminder that appears while any active draft has
an unknown amount. The reminder is one repeating 20:00 local request. It opens
the fixed Drafts inbox, preserves unrelated notification requests, and is
removed when no unknown drafts remain.

The original tested implementation revision is `4e49b38`. The native dependency and
app configuration are present in that revision. There is no iPhone, signed
IPA, or macOS runner result in this workspace, so native delivery and device
navigation remain pending.

On 2026-09-17, a follow-up regression test reproduced a retained notification
tap being lost when the root remounted before navigation was ready. The fix
marks a delivery handled only after Drafts is visible. All 12 reminder
component tests, 3 response logic tests, and TypeScript checks pass after the
fix. The component tests also verify that a native cleanup failure does not
cause a confirmed delivery to navigate again after a remount.

The latest successful CI run inspected on 2026-09-17 built `6d96910`, which
predates the reminder implementation. [That build](https://github.com/NgTHung/Carryover/actions/runs/34760114672)
does not verify this feature. A new candidate must include the navigation fix.

## Candidate identity

| Field | Result |
| --- | --- |
| Tested implementation revision | `4e49b38` |
| CI workflow URL | PENDING |
| IPA artifact | PENDING |
| Variant | PENDING |
| Bundle identifier | PENDING |
| IPA signing and install | PENDING |
| iPhone model and iOS version | PENDING |
| Device timezone | PENDING |
| Widget | Disabled for the normal candidate |

The throwaway prebuild inspection passed for release, development, and
widget-enabled release. All three generated configurations retained their
variant App Group, contained no `aps-environment`, and contained no
`remote-notification` background mode after the existing entitlement-strip
step. This is configuration evidence, not device evidence.

## Automated evidence

| Check | Result |
| --- | --- |
| Notification adapter, policy, service, response, and app variants | PASS, 42 logic tests |
| Draft inbox query and reminder integration | PASS, 5 database tests |
| Restart schedule repair | PASS, 1 database test |
| Reminder controls and lifecycle | PASS |
| Real Expo Router reminder navigation | PASS, including empty inbox and pending editor completion |
| Full Jest gate | PASS, 122 suites and 658 tests |
| Python gate | PASS, 12 tests |
| TypeScript check | PASS |
| Expo dependency check | PASS |
| Expo Doctor | PASS, 21 checks |
| Web export | PASS |
| iOS JavaScript export | PASS |
| Taskroot validation | PASS, 87 tasks and 0 warnings |
| Git whitespace check | PASS |

Commands used for the final local gate:

```text
npm run test:logic -- --runInBand --runTestsByPath tests/notification-adapter.logic.test.ts tests/draft-nudge-policy.logic.test.ts tests/draft-nudge-service.logic.test.ts tests/draft-nudge-response.logic.test.ts tests/app-variants.logic.test.ts
npm run test:database -- --runInBand --runTestsByPath tests/draft-inbox.database.test.ts tests/draft-nudge.integration.database.test.ts tests/draft-nudge-restart.database.test.ts
npm test -- --runInBand
python3 -m unittest discover -s tests -p '*_test.py'
npm run typecheck
npx expo install --check
npm run doctor
npm run web:export
npx expo export --platform ios
taskroot validate
git diff --check
```

The database tests use real migrations, capture and manual transaction
facades, the committed ledger notifier, and a fake persisted OS adapter. They
cover historical and current unknowns, known drafts, partial amount saves,
completion, deletion, clearing an amount, rollback, exact integer snapshot
totals, scheduling and cancellation failures, snapshot-writer failure,
duplicate requests, stale requests, missing requests, unrelated requests, and
file-backed restart repair.

Notification reconciliation runs after a ledger commit and never participates
in the money write. SQLite and the operating system do not share a transaction.
A process kill between those systems can leave one old reminder until the next
startup inspection repairs it. The restart test records that boundary instead
of treating cancellation as atomic.

## Native evidence

Replace `PENDING` only with observations from the exact IPA identified above.
Keep the widget disabled for the normal candidate.

| Scenario | Result |
| --- | --- |
| Fresh install, contextual permission action in Drafts | PENDING |
| Startup and capture do not show a permission prompt | PENDING |
| Permission denial keeps capture, partial save, completion, and deletion usable | PENDING |
| Provisional or quiet permission shows the quiet delivery copy | PENDING |
| One pending 20:00 local request with unknown drafts | PENDING |
| Mixed periods and known draft preserve one request | PENDING |
| Last unknown resolved by amount save, completion, or deletion cancels it | PENDING |
| Foreground owned reminder has no banner, sound, badge, or list entry | PENDING |
| Background and locked-device delivery while offline | PENDING |
| Warm tap opens Drafts once | PENDING |
| Force-quit tap opens Drafts after the migration gate | PENDING |
| Tap from an empty inbox still opens Drafts | PENDING |
| Tap from an editor preserves the pending write and leaves Drafts visible | PENDING |
| Returning from Settings reconciles denial and regrant | PENDING |
| Timezone change keeps the next trigger at 20:00 without duplicates | PENDING |
| Larger text, VoiceOver, scrolling, and safe-area controls | PENDING |
| Installed signing and App Group identity | PENDING |

The CI-built iPhone candidate is required before CAPTURE-006 can be closed.
