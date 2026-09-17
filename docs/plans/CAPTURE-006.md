# CAPTURE-006 execution plan

Date: 2026-09-17

Task: [Nudge while unknown drafts exist](../../.tasks/app/CAPTURE-006-nudge-while-unknown-drafts-exist.md)

## Verification timing update

On 2026-09-17, you deferred device verification until all features are implemented. Stage 5 iPhone checks now belong to build:BUILD-005. CAPTURE-006 can close on local implementation evidence while every unobserved native result remains PENDING in docs/build/draft-nudge.md. This decision supersedes the device-before-closure requirement below.

## Outcome and readiness

You can enable one daily local reminder from Drafts when unknowns exist. It opens the draft inbox. Resolving the last unknown cancels future reminders. Permission denial and notification failures leave capture, partial saves, completion, and deletion usable.

Taskroot reports CAPTURE-006 ready with no blockers. CAPTURE-005 is Done. Its iPhone checks remain pending in docs/build/draft-inbox.md, so its closure does not prove native behavior for this feature. CAPTURE-006 stays To Do during planning. Start it only when implementation begins.

This plan uses CONTEXT.md, docs/app-stack-and-testing.md, docs/state-and-validation.md, and docs/build/ios-unsigned-ipa.md. The steps below produce separate reviewable commits. Keep complex changes below 500 changed lines per stage, other nonmechanical changes below 800, and modules below 400 lines where practical. Split a stage further when its tests exceed that allowance. Obtain consent before pushing.

## Existing boundaries

| Existing code | Use in this task |
| --- | --- |
| src/data/draft-inbox.ts | Extend the active-draft read boundary with an existence query for unknowns across all periods. |
| src/data/ledger-change-notifier.ts | Subscribe to committed transaction changes independently of snapshot publication. |
| src/ui/ledger-access.ts and ledger-access.web.ts | Keep native database composition behind the existing platform boundary. |
| src/app/_layout.tsx | Start the reminder service after migrations and receive notification taps once navigation is mounted. |
| src/app/_layout.web.tsx | Preserve the browser navigation shell without native notification imports. |
| src/app/drafts.tsx and src/ui/drafts/DraftInboxView.tsx | Add contextual permission and reminder status controls. |
| src/app/transactions/[transactionId].tsx | Preserve existing pending-write protection and successful return to Drafts. |
| src/budget/snapshot-publisher.ts | Keep budget publication independent of notification scheduling. |
| app.config.js and scripts/strip-push-entitlement.mjs | Configure the new native dependency while preserving unsigned sideload builds. |
| tests/app-variants.logic.test.ts and tests/router-navigation.component.test.tsx | Extend configuration and real-router regression coverage. |

There is no notification dependency or reminder service today. The native root already gates ledger access on migrations. The draft inbox already spans periods and can show known amounts alongside unknowns. Notification eligibility must therefore use unknown existence, not inbox length or a selected period.

## Product decisions

These defaults make the task executable. They are choices for this feature, not requirements already specified by CAPTURE-006.

1. Schedule at 20:00 in the device's local timezone. Use one repeating daily calendar trigger. Do not schedule a rolling 24-hour interval or one request per draft. Creating an unknown after 20:00 waits for the next occurrence; there is no immediate catch-up notification.
2. An unknown is an active transaction with status draft and amount null. Include every period and every draft direction allowed by the schema. Do not require a photo, category, or active joined account. Known-amount drafts do not qualify.
3. Offer Enable daily reminder in Drafts only after a successful read confirms unknowns. Explain: Remind me at 20:00 while drafts have an unknown amount. Request system permission only when you press this action. Startup, capture, and automatic reconciliation never open a permission prompt.
4. Request alert permission without requesting sound or badge permission. Use title Complete your drafts and body Open Drafts to add unknown amounts. The copy contains no count, money, contact, or photo details that could become stale or appear on the lock screen.
5. Permission authorizes reminders for later unknowns too. If permission already permits delivery, reconcile automatically. The first implementation uses iOS notification settings to disable reminders; it adds no separate persisted opt-in or time preference.
6. Denial shows Daily reminders are off with an Open notification settings action. Do not repeat the system prompt on later captures or app launches. Returning from settings rereads permission and ledger state. A settings-launch error remains recoverable in the same control.
7. A reminder error shows Daily reminder unavailable and Try again in Drafts. This retry repairs notification state only. Keep the inbox, editor, and capture actions available. Do not show a success state until pending requests have been verified.
8. Suppress this reminder's banner, sound, badge, and notification-list presentation while the app is foregrounded. The inbox already exposes unknowns. Background delivery remains an iOS responsibility; Focus and notification settings can affect visible delivery.
9. Completing, deleting, or partially saving an amount on the last unknown cancels the reminder. Removing an amount from an active draft makes it eligible again. Changes to known-only drafts cannot create a reminder.
10. A tap always targets the fixed /drafts route, including when the inbox is now empty. Never interpret a notification payload as an arbitrary URL or a transaction identifier.

Remote push, APNs tokens, Expo push tokens, servers, background polling, OCR, per-draft reminders, settings redesign, custom reminder times, and widget changes are outside scope. No migration or budget arithmetic change is needed.

## Dependency and native configuration

Install expo-notifications with npx expo install expo-notifications so the installed Expo SDK selects the compatible release. Commit package.json and package-lock.json. This native dependency earns its place by providing local scheduling, permission state, and tap responses that existing dependencies do not provide.

Expo documents daily triggers, pending-request inspection, targeted cancellation, permission APIs, foreground handlers, and notification responses. Its current plugin also sets an APNs entitlement; disabling background remote notifications does not remove that entitlement. Use the installed package's declarations and plugin source to verify API details during implementation. [Expo Notifications reference](https://docs.expo.dev/versions/latest/sdk/notifications/).

Add the plugin with enableBackgroundRemoteNotifications false. Preserve the existing post-prebuild entitlement stripping. Inspect generated entitlements and Info.plist in release, development, and widget-enabled release configurations: no aps-environment, no newly enabled remote-notification background mode, unchanged bundle identifiers and App Groups. Do not request push tokens or add signing credentials. Keep native module imports outside src/app behind a platform adapter, with an unavailable web implementation.

Use generated-project inspection with --no-install in a disposable checkout on Linux if useful. Use the repository prebuild sequence, including patch-expo-widgets.mjs and strip-push-entitlement.mjs. Pod installation and iOS compilation remain in GitHub Actions. Never commit generated ios/ output.

## Module ownership and contracts

| Proposed module or change | Responsibility |
| --- | --- |
| src/data/draft-inbox.ts | Add hasUnknownDrafts(): Promise<boolean> using status draft, amount IS NULL, activeRowFilter, and LIMIT 1. No joins, sorting, decoding unrelated rows, or writes. |
| src/notifications/draft-nudge-contract.ts | Define permission, owned request, schedule specification, adapter, and service state types without importing native modules. |
| src/notifications/draft-nudge-policy.ts | Pure desired-state calculation: keep, cancel owned requests, or cancel then schedule. Define identity, payload version, copy, and time once. |
| src/notifications/notification-adapter.ts and notification-adapter.web.ts | Map Expo permission and request shapes into narrow contracts; wrap scheduling, inspection, cancellation, presentation, and response APIs. Web reports unavailable. |
| src/notifications/draft-nudge-service.ts | Serialize reconciliation and permission actions; own invalidation, retries, disposal, and observable reminder state. |
| src/notifications/draft-nudge-access.ts and draft-nudge-access.web.ts | Compose one process-level service with ledger access, native adapter, and AppState. Share it between the root and Drafts. |
| src/notifications/draft-nudge-response.ts | Validate owned response data and deduplicate individual deliveries. Keep this separate from scheduling. |
| src/ui/notifications/DraftNudgeLifecycle.tsx | Bind service lifetime and safe notification navigation to the mounted native root. |
| src/ui/notifications/DraftNudgeControl.tsx | Render reminder permission, enabled, busy, denied, unavailable, and error states using existing controls. |
| src/app/_layout.tsx, src/app/drafts.tsx, and DraftInboxView.tsx | Small composition changes. Allow the shared inbox view to receive an optional reminder control without importing native services. |
| tests/ and docs/build/draft-nudge.md | Automated evidence and the native verification record. |

Use discriminated unions for permission and service states. Distinguish unknown permission from denied permission, failed ledger reads from no unknowns, and successful scheduling from permission alone. UI state may contain the last successful eligibility observation, but never persist a second draft collection or treat it as authoritative after invalidation.

The adapter should expose inspectPermission, requestPermission, listScheduled, scheduleDailyNudge, cancelScheduled, response subscription, last-response read/clear, and owned delivered-notification cleanup. Normalize native request shapes before comparing them. iOS can report a calendar representation for a daily input. A literal comparison against the scheduling input would cause needless cancel/reschedule loops.

Normalize authorized and provisional permission as allowed, retaining whether delivery is quiet for accurate UI copy. Treat not determined as requestable, denied as off, and unrecognized or failed permission reads as unavailable rather than granted. Handle any additional installed-SDK status explicitly; this full app does not request App Clip ephemeral authorization. Recheck canAskAgain before requesting.

## Reconciliation algorithm

Use one stable identifier, carryover.unknown-drafts.daily.v1, and a namespaced payload with kind carryover-unknown-drafts and version 1. Ownership checks recognize the exact identifier or this feature's validated marker so duplicate owned requests with other identifiers can be removed. Preserve unrelated requests. Never call cancelAllScheduledNotificationsAsync.

1. After migrations succeed, subscribe to transaction commits and AppState before triggering the startup read. Start exactly one worker for the process. Root remounts must not create concurrent schedulers.
2. On startup, a committed transaction mutation, transition into active, explicit retry, or completion of a permission request, mark reconciliation dirty. Permission prompting runs only through the explicit UI action. Other ledger table events need no work.
3. A serial drain loop reads authoritative unknown existence, current permission, and pending native requests. Each invalidation increments a generation. If an awaited read became stale before side effects start, reread instead of applying its plan.
4. When no unknowns exist, cancel every owned pending request and dismiss owned delivered reminders. Cancellation of known owned requests can proceed even if permission lookup fails. When permission is denied or not determined, also remove owned pending requests. Do not interpret an eligibility-read failure as no unknowns.
5. When unknowns exist and permission allows delivery, keep one canonical request only if its normalized trigger, identity, payload, and copy match. Remove extra owned requests. If no valid canonical request remains, cancel obsolete owned requests before scheduling the canonical one. If cancellation fails, do not schedule an additional request.
6. Inspect pending requests again after changes. Declare enabled only when exactly one matching owned request remains. Declare idle or permission off only after required cancellation succeeds. Limit each drain attempt; a persistent mismatch becomes a surfaced error, not a busy retry loop.
7. If a commit arrives while an OS write is in flight, let that write settle, then immediately run again from fresh data. This covers completion during permission or schedule calls. A schedule result from the old generation must not become the displayed final state.
8. On a rejected scheduling call, assume its OS outcome may be uncertain. Retry begins by inspecting native requests and reusing or repairing the stable identifier. Never blindly enqueue another notification. Apply the same inspection-first recovery after cancellation or response-cleanup errors.
9. Notification exceptions are contained by this service, reported with operation context, and exposed in its error state. Ledger writes and the snapshot publisher do not await notification success. Async subscriptions must catch failures themselves because the notifier catches synchronous listener errors only.
10. Cleanup removes listeners and blocks new work and stale UI updates. Root unmount is not a request to cancel the durable daily reminder. Reuse the same serialized service across development remounts and drain any already issued native call before a replacement worker can start.

SQLite and the operating system do not share a transaction. A process kill between a ledger commit and OS cancellation can leave a reminder until the next launch. Startup reconciliation repairs it. Record this recovery boundary explicitly in tests and device evidence rather than claiming cancellation is atomic with the ledger. Normal completion should trigger cancellation promptly without delaying the successful money write.

## Notification response handling

Register the response listener before reading the retained launch response. Buffer a valid response while migrations or the root navigator are unavailable. Process it once the navigator is ready. A migration failure keeps the existing error screen and must not open a ledger route.

Accept only the default tap action and validated feature marker. Use a delivery identity containing request identifier, delivered notification date, and action identifier. The stable schedule identifier alone is insufficient because tomorrow's tap must still work. Deduplicate the retained response and live event for the same delivery. Do not erase a newer response when clearing an older one.

Use router.push('/drafts') when another route is active, and avoid adding another inbox when already there. Pushing preserves any underlying editor and its in-flight write. Do not replace or dismiss an editor from the notification handler. Verify with the real router that a successful editor callback cannot redirect the user away from the inbox after the tap; if it does, make the smallest focus-aware navigation fix in that route and cover it with a regression test.

Mark navigation handled and clear the retained owned response only after the destination is confirmed. If navigation fails, retain a retryable intent and retry after readiness or foreground recovery. A failed clear must not cause another navigation during the same process. Test that reopening normally after a handled tap does not reopen Drafts. Ignore malformed and unrelated responses without clearing another feature's response.

## Execution stages

### Stage 1. Refine task intent and establish the native boundary

1. Recheck git status, taskroot validate, taskroot list, and taskroot context app:CAPTURE-006 --format json. Preserve unrelated changes. The task already links this plan; confirm it still matches the four acceptance criteria and leave the criteria unchecked.
2. Run taskroot start app:CAPTURE-006 immediately before implementation. Validate and list again.
3. Install expo-notifications, inspect its installed API and plugin, and add configuration and the adapter contracts/platform boundary. Do not wire scheduling into the root yet.
4. Update app-variants configuration assertions. Add adapter tests for permission mapping, daily schedule shape, native request normalization, targeted cancellation, response mapping, and rejected calls.
5. Verify release/development identities, widget flag behavior, generated push entitlement removal, typecheck, and web/iOS JavaScript exports. Record the native build requirement introduced by this dependency.

Commit: feat(capture): add local notification adapter

Exit: a typed and tested native boundary builds into both JavaScript targets, with no production scheduling active yet. Once pushing is authorized, obtain a green CI native build for this dependency stage before stacking further native changes.

### Stage 2. Implement authoritative eligibility and scheduling policy

1. Add hasUnknownDrafts to the existing data service and expose it through a narrow service dependency. Use SQL null semantics, not truthiness or amount arithmetic.
2. Write real SQLite cases for old/current periods, known/unknown drafts, complete rows, soft-deleted rows, absent photos, and inactive referenced metadata. Prove the query performs no writes.
3. Implement the pure policy with the fixed identity and 20:00 schedule. Cover keep, cancel, replacement, duplicate cleanup, unavailable permission, and unrelated notifications.
4. Run the focused database/policy suites and typecheck. Review the diff for duplicated predicates and scope growth.

Commit: feat(capture): define unknown draft reminder policy

Exit: eligibility and desired native state are deterministic and covered without loading React Native or changing budget output.

### Stage 3. Implement the serialized reconciliation service

1. Implement the worker, dirty-generation handling, state subscription, permission action, and inspection-first retry using the injected reader and adapter.
2. Add tests with deferred promises for overlapping startup/foreground/commit events, stale reads, completion during prompting, completion during scheduling, uncertain OS outcomes, cancellation failures, and disposal/remount.
3. Prove one worker cannot schedule before duplicate cancellation succeeds and a new worker cannot race an old worker's outstanding call.
4. Wire service composition to committed ledger notifications and AppState. Keep root mounting for the following stage so this commit remains independently testable.

Commit: feat(capture): reconcile daily reminders after ledger changes

Exit: successful drains converge to zero or one owned request; failures surface without affecting committed ledger operations.

### Stage 4. Connect contextual permission and notification navigation

1. Mount the lifecycle integration after the migration gate and implement retained/live response handling with navigator readiness.
2. Add the Drafts reminder control with explanatory copy, explicit permission action, denied/settings state, progress, and retry. Reuse existing UI primitives and platform boundaries.
3. Configure foreground presentation suppression for owned reminders. No capture operation requests permission or awaits this service.
4. Add component and real-router tests for permission timing, denial, error recovery, cold/warm taps, duplicate events, next-day taps, migration failure, empty inbox, and editor preservation during a pending write.
5. Verify web preview imports no native notification module. Run affected router, Drafts, capture, and editor tests.

Commits, split as needed:

- feat(capture): expose contextual daily reminder controls
- feat(capture): open drafts from local reminders

Exit: the complete feature is wired, capture remains usable in every permission state, and navigation works through the actual router gate.

### Stage 5. Prove ledger recovery and record local evidence

1. Add tests/draft-nudge.integration.database.test.ts using real migrations and the existing capture/manual transaction facades, a fake OS adapter, and the actual notifier. Reuse tests/support/sqlite-proxy.ts and relevant completion fixtures.
2. Exercise unknown creation, known creation, partial amount save, completion, deletion, clearing an amount, historical edits, and rollback. Assert exact stored amounts and published snapshot behavior remain correct through the existing budget engine.
3. Fail notification scheduling and cancellation after commits. Assert rows stay committed, no duplicate transaction write occurs, and notification-only retry repairs requests. Separately fail snapshot storage and prove reminder reconciliation still reads the committed ledger.
4. Close/reopen a file-backed database and construct fresh services while retaining fake OS requests. Cover valid, duplicate, missing, and stale schedules, including a simulated kill after the last unknown was resolved.
5. Run the full local gate below. Add docs/build/draft-nudge.md with revision, commands, results, and every native check marked PENDING until observed.

Commits, split as needed:

- test(capture): verify reminder mutations and restart recovery
- docs(capture): record local reminder verification

Exit: automated evidence covers authoritative data, OS recovery, and separation from money writes. Do not mark native acceptance complete from mocked tests or JavaScript exports.

### Stage 6. Verify the CI-built iPhone candidate and close

1. With push consent, use the existing GitHub Actions workflow to build the new native dependency. Do not run local Xcode or simulator builds. Keep the widget disabled for the normal candidate.
2. Record the workflow URL, commit, variant, bundle identifier, IPA build identity, device model, iOS version, and timezone. Verify a release candidate without Metro as well as any development diagnostic run.
3. Run the matrix below and record observed outcomes. If testing delivery at a near-term time, inject a development-only schedule through the same service in a separate diagnostic change, keep the single-request rule, and remove it before final verification. The final 20:00 trigger still requires confirmation; a short interval test alone cannot prove it.
4. Fix failures in focused commits and rerun affected checks. Keep earlier capture/inbox native gaps separate from new reminder evidence.
5. Check each acceptance item only when its evidence is recorded. Run taskroot validate, taskroot done app:CAPTURE-006, taskroot validate, taskroot list, and taskroot show app:CAPTURE-006. Leave the task In Progress if required iPhone evidence is unavailable unless you explicitly direct closure with that evidence pending.

Commit: docs(capture): record iPhone reminder verification

## Test and acceptance matrix

| Acceptance criterion | Automated evidence | iPhone evidence |
| --- | --- | --- |
| Contextual permission; denial leaves capture/completion usable | No prompt at startup/capture; explicit Drafts action; denied, provisional, settings return, request failure, rapid repeated taps | Fresh permission grant and denial, then capture and complete under both states |
| At most one daily reminder; last unknown cancels | Mixed periods and amount states; duplicate repair; repeated lifecycle events; last unknown completed, deleted, or given an amount; unrelated requests preserved | One pending daily request; delivery at configured time; cancellation while a known draft remains |
| Startup/foreground reconciliation; tap opens inbox | Fresh service with persisted ledger/OS state; cold and warm responses; readiness gate; per-delivery deduplication; retained-response cleanup | Force-quit launch from reminder, warm tap, normal subsequent launch, settings revocation/regrant |
| Adapter failures and device delivery/navigation | Permission/list/schedule/cancel failures; partial side effects; retries; platform/configuration tests | Signed release candidate receives local reminder offline and opens Drafts |

Additional iPhone procedures:

- Create two unknowns in different periods. Resolve one and verify the daily request remains. Resolve the second through a partial amount save, then repeat using completion and deletion. Keep a known draft to prove the inbox is not the scheduling condition.
- Background the app before delivery, lock the phone, and repeat offline and after force-quit. Record Focus, Scheduled Summary, and alert settings so a quiet delivery is not mistaken for a missing schedule.
- Tap from Home, an empty inbox, and an editor. Check that the route opens once, edits remain recoverable, and Back behavior is usable. Verify a later day's notification still opens Drafts.
- Revoke permission in Settings, foreground, and verify owned pending requests are removed. Regrant, foreground, and verify exactly one is restored if unknowns still exist.
- Verify no foreground banner interrupts capture. Check readable controls with larger text, VoiceOver, and the existing safe-area layout.
- Change timezone using test data, foreground, and inspect the next trigger. Confirm it remains 20:00 local time without duplicates. Exercise calendar boundaries and DST normalization in adapter tests even though the normal Asia/Ho_Chi_Minh timezone has no DST.
- Inspect generated and installed signing information for the intended candidate. Confirm notification delivery works through the existing sideload path without adding push capability.

Use adapter inspection in test diagnostics to count owned requests. Multiple displayed notifications from different days are not proof of duplicate pending schedules. Clean up owned delivered reminders when no unknowns remain.

## Verification commands

Run focused suites after their files exist:

```bash
npm run test:logic -- --runInBand --runTestsByPath tests/notification-adapter.logic.test.ts tests/draft-nudge-policy.logic.test.ts tests/draft-nudge-service.logic.test.ts tests/draft-nudge-response.logic.test.ts tests/app-variants.logic.test.ts
npm run test:database -- --runInBand --runTestsByPath tests/draft-inbox.database.test.ts tests/draft-nudge.integration.database.test.ts tests/draft-nudge-restart.database.test.ts
npm run test:component -- --runInBand --runTestsByPath tests/draft-nudge.component.test.tsx tests/draft-nudge-navigation.component.test.tsx tests/router-navigation.component.test.tsx tests/draft-inbox-route.component.test.tsx tests/capture-route.component.test.tsx tests/transaction-editor-route.component.test.tsx
npm run typecheck
git diff --check
git diff --stat
taskroot validate
```

If the installed native adapter cannot load in the logic Jest project, mock its Expo boundary explicitly or put the adapter test in the component project. Keep policy and service tests in the Node logic project. Test real SQL in the database project.

Before native verification and task completion:

```bash
npx expo install --check
npm run doctor
npm run typecheck
npm test -- --runInBand
python3 -m unittest discover -s tests -p '*_test.py'
npm run web:export
npx expo export --platform ios
taskroot validate
taskroot list
git diff --check
git status --short
```

Record pre-existing failures separately and investigate any newly introduced dependency or build issue. JavaScript exports establish bundling only. The macOS workflow and the identified iPhone candidate provide native build, signing, delivery, and navigation evidence.
