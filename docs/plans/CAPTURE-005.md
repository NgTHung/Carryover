# CAPTURE-005 execution plan

Date: 2026-09-16

Task: [Browse and recover photo drafts](../../.tasks/app/CAPTURE-005-browse-and-recover-photo-drafts.md)

## Outcome and readiness

You can open Drafts from Home or Transactions, find every active draft across periods, see its photo or an explicit fallback, and reopen the existing transaction editor. Saving partial changes, completing, or soft-deleting returns you to the refreshed inbox. A restart rebuilds the inbox from SQLite and the Home unknown count from the published snapshot.

CAPTURE-004 is closed at your request. Its local verification passes; its iPhone matrix remains pending in docs/build/draft-completion.md. That closure does not establish native verification for this task. CAPTURE-005 remains To Do while this plan is written. Start it only when implementation begins and taskroot reports no blockers.

Use CONTEXT.md, docs/state-and-validation.md, docs/app-stack-and-testing.md, and docs/spec/period-income-policy.md as contracts. Keep the existing controls and styling. Notifications belong to CAPTURE-006, and the visual redesign belongs to milestone 0.9.0.

## Existing behavior and gaps

| Existing module | Reuse | Required change |
| --- | --- | --- |
| src/data/transactions.ts | Transaction decoding, default soft-delete visibility, same-row reads | Add a separate draft read module so the inbox does not load the full ledger or inherit period filters. |
| src/data/transaction-list.ts | Evidence of current period-scoped Transactions behavior | Keep its filters independent of Drafts. Add navigation in its view. |
| src/ui/transactions/TransactionEditor.tsx | Partial saves, completion recovery, delete confirmation, duplicate-write protection, retained photo | Reuse the editor. Parameterize its successful return label without adding another mutation flow. |
| src/app/transactions/[transactionId].tsx | Identity validation, active-row reads, pending-write navigation protection, navigation-only retry | Accept a small allowlisted origin parameter for returning to Drafts. |
| src/data/manual-transactions.ts | Atomic edits, completion, soft deletion, period preparation, current income updates | Keep this as the mutation boundary. |
| src/ui/photos/PhotoThumbnail.tsx | Loading, absent, unavailable, image-error fallback, stale-result protection, revision prop | Render it in each draft row with an injected resolver. |
| src/ui/ledger-access.ts and src/data/database.ts | Native service composition behind the migration gate | Expose the draft read service through the existing platform boundary. |
| src/ui/home/HomeSnapshotView.tsx | Stable Home actions and snapshot-owned unknown count | Add a permanent Drafts action and make the existing unknown badge open Drafts. |
| src/budget/snapshot-publisher.ts | Commit-triggered refresh and publication-only retry | Verify draft mutations through this path; add no UI budget arithmetic. |

The editor currently returns every successful mutation to /transactions. Home's unknown badge is static and disappears when the unknown count is zero. A known-amount draft therefore needs a permanent navigation entry independent of that badge. The Transactions list can include drafts, but its period and category filters cannot serve as the inbox.

## Product and data decisions

1. Use /drafts as the stable inbox route and Drafts as its visible title. Home and Transactions expose an action with that label in loading, error, empty, and ready states. This also gives CAPTURE-006 a route to target later.
2. Include every transaction with status draft and deletedAt null, across all periods and directions permitted by the existing schema. Do not require a photo key, an available file, an active category, or a currently active account to include a row. Older or partially edited drafts must stay reachable.
3. Sort oldest captured first by createdAt ascending, then id ascending as a deterministic tie-breaker. Editing occurredAt must not move a neglected capture behind newer captures. Display occurredAt as the transaction date.
4. Show the photo thumbnail, date, direction, amount state, and an optional note preview. Use the existing formatVnd helper for non-null amounts. A null amount displays Unknown amount. Never use truthiness, an amount sum, or a zero fallback to describe an unknown.
5. Open /transactions/[transactionId]?from=drafts from a row. Use the same transaction id for every partial save, completion, and deletion. Do not create a draft-specific editor or recapture an existing photo.
6. Use the editor's existing Delete action and inline confirmation. Inbox swipe deletion, bulk completion, restore, photo replacement, OCR, search, and inbox filters are outside this task. The task's deletion requirement is satisfied through the editor.
7. Return to /drafts after a successful save, completion, or deletion when from=drafts. Ordinary transaction links retain /transactions as their destination. Hardware or gesture back continues to use router history and remains protected during a write.
8. Home's count remains snapshot.unloggedDrafts, the count of active drafts with no amount. It is not the number of inbox rows. A known-only inbox still has a reachable Drafts action, even when Home has no unknown badge. Use Unknown or Unknowns in new user-facing count copy; preserve the existing snapshot field name.
9. A missing photo affects only its thumbnail. Deleting a draft sets deletedAt through the manual transaction facade and retains its photo key and file. Do not add file cleanup to a ledger mutation.
10. Keep SQLite as the durable source. Do not persist a second draft collection in Zustand or storage. Add no migration, native dependency, snapshot field, or alternate budget computation for this feature.

## Read boundary and module ownership

Add src/data/draft-inbox.ts with createDraftInboxData(db).readActiveDrafts(): Promise<DraftTransaction[]>. Query transactions with status draft and activeRowFilter(transactions.deletedAt), ordered by createdAt then id. Decode rows through toTransaction and narrow on status without an assertion. Treat an unexpected decoded status as a contextual error. Preserve null amounts and dates exactly. No joins are needed for the required row fields, so deleted account or category metadata cannot hide a draft.

Keep this public API active-only. Audit and backup reads already have separate opt-in paths. A plain read must not open a period, publish a snapshot, inspect files, or write anything. Verify that behavior in database tests.

| Module to add or change | Responsibility |
| --- | --- |
| src/data/draft-inbox.ts | Typed, ordered, active-only draft query. |
| src/data/database.ts | Construct the native read service using the existing database. |
| src/ui/ledger-access.ts and ledger-access.web.ts | Export getDraftInboxData; retain the explicit unavailable web boundary. |
| src/ui/drafts/draft-inbox-contract.ts | Narrow read dependency and discriminated loading, ready, and error states. |
| src/ui/drafts/useDraftInbox.ts | Read lifecycle, mutation invalidation, focus and foreground refresh, retries, stale-result protection. |
| src/ui/drafts/DraftInboxView.tsx | Safe-area layout, virtualized list, navigation, loading, empty, and error states. |
| src/ui/drafts/DraftInboxRow.tsx | Photo, exact amount or Unknown amount, transaction date, and accessible open action. |
| src/app/drafts.tsx and drafts.web.tsx | Native dependency injection and a browser unavailable screen with working navigation. |
| src/ui/transactions/transaction-return-route.ts | Pure parser mapping the optional origin to one fixed destination and label. |
| Existing Home, Transactions, and transaction editor route/view modules | Wire navigation and the return destination. |

These boundaries avoid growing TransactionEditor.tsx, currently 563 lines, into another feature module. Keep additions below 400 lines per module where practical. Extract only shared behavior actually needed by this work. Do not introduce a general query framework or refactor all route loading.

## Loading and refresh lifecycle

1. Subscribe to committed transaction invalidations before the initial read can finish. Load after the existing migration gate. Read on initial route focus, on later focus, and when the app becomes active. Coalesce duplicate initial triggers if necessary without dropping a later invalidation.
2. On transactions created, edited, completed, or deleted, reread the public draft API. The read has no account or category label dependency, so those table changes need no subscription. Keep the Home snapshot publisher's existing subscriptions unchanged.
3. Increment a request generation for each read. Apply a result only when it is the latest generation and the consumer is still mounted. Invalidate pending requests and unsubscribe all listeners on cleanup.
4. Represent loading, ready, and error as a discriminated union. An empty list is a successful read with zero rows. A failed read displays an error and Try again; it never becomes an empty inbox or a zero count. Keep Home and Transactions navigation available in every state.
5. Use a FlatList keyed by transaction id. Load visible thumbnails independently. Slow, rejected, corrupt, or missing photo resolution must not delay the list read or disable opening a draft.
6. Advance the thumbnail revision when a fresh inbox read succeeds so returning to the app can retry unavailable files through PhotoThumbnail's existing revision prop. Do not persist absolute file URIs.
7. After a committed editor mutation, the ledger notifier invalidates the inbox and the snapshot publisher independently. Returning to Drafts also reads on focus, covering mutations that occurred while its screen was unmounted.
8. Reopening the app reads SQLite again. A new process does not need past notifier events or a saved navigation stack to recover drafts.
9. If snapshot publication fails, keep the committed ledger result and the refreshed inbox. Home shows its existing publication error and publication-only retry. Never undo or repeat the mutation to repair a snapshot.

## Editor return and failure behavior

Parse from using one pure helper. Only the exact string drafts maps to /drafts and Back to drafts. Missing, unknown, or array-valued parameters fall back to /transactions and Back to transactions. Never accept an arbitrary return URL. Both editor success and navigation-only retry use the same parsed destination.

Pass the return label into the editor's existing terminal saved state. Preserve its current default for callers that do not supply it. Keep committed state set before navigation starts, and release pending-write navigation protection before replacing the route. A navigation exception must leave a terminal saved state whose retry only navigates.

Saving partial input returns to the inbox with the same draft. Completing or deleting removes the row only after the authoritative read confirms it is no longer active and draft. Do not optimistically remove rows or adjust Home's unknown count in UI code. A failed database mutation preserves the draft and input, exposes the error, and offers the existing retry.

If a row changed between listing and opening, use the existing route read: a complete row opens as a complete transaction; a deleted or missing row displays unavailable. Ensure unavailable and route-error views provide a way back to the inbox when entered from Drafts. Do not recreate missing rows. Retain CAPTURE-004's completion reconciliation and duplicate-submit protection unchanged except where return navigation requires wiring.

## Acceptance evidence

| Task criterion | Evidence required |
| --- | --- |
| Home and Transactions reach drafts with thumbnails and completion links | Route tests open /drafts from both surfaces and the Home unknown badge, then open the same transaction id in the existing editor. Component tests cover thumbnail success and fallback. |
| Known amounts and unknowns remain distinct | Mixed-row tests show 45,001 VND and Unknown amount independently, including rows with null keys, missing files, and decode failures. A known-only inbox remains reachable. |
| Reopen, complete, soft-delete, refresh, and restart | Database and route tests cover partial save, completion, confirmed deletion, cancellation, committed invalidation, focus refresh, snapshot refresh, and file-backed close/reopen. |
| Empty, error, missing-photo, and persisted recovery coverage | Dedicated read, view, lifecycle, integration, and restart suites prove each state without relying on in-memory fixtures alone. |

### Database and snapshot cases

- Seed known and unknown drafts across two periods, income drafts permitted by the schema, a complete transaction, and a soft-deleted draft. Return only active drafts, with exact amounts, nulls, identity, photo keys, and stable ordering. Include equal creation timestamps and out-of-order inserts.
- Include a draft with no photo key and one referencing unavailable photo bytes. The read API must not invoke file access. Include inactive account/category references where the stored schema permits them.
- Complete an unknown expense for 45,001 VND through manualTransactionData. Verify same-row promotion, disappearance from the inbox, and one fewer unknown in the published snapshot. Complete a known expense without changing its amount and prove it is not charged twice.
- Save an unknown draft with a known amount without completing it. It remains in Drafts, displays the exact amount, and stops contributing to the snapshot's unknown count.
- Soft-delete one unknown and one known expense draft through the same facade. Inspect storage to prove rows and photo keys remain while public reads omit them. Verify unknown count and exact spending changes through computeBudget's published output.
- Soft-delete a current-period known income draft. Prove current income maintenance runs atomically. Include a historical draft mutation and verify past month config money totals remain frozen.
- Inject a deletion SQL failure. Prove rollback, unchanged inbox membership, unchanged period income, and no committed transaction event. Use the existing atomic fixture patterns instead of mocking SQLite correctness.
- Fail shared snapshot storage after a committed mutation. The row stays complete or deleted, Home is in publication error, and publication-only retry restores the snapshot without another transaction write.
- Close a file-backed migrated database containing active known/unknown drafts, a completed row, and a deleted row. Construct fresh services on reopen. Verify only the active drafts return with the same ids, nulls, amounts, and photo keys; recompute and publish Home's count from those stored rows.

### Component, route, and lifecycle cases

- Cover loading, ready mixed rows, known-only rows, successful empty read, failed read, and read-only retry. Error and loading states keep navigation available.
- Cover photo loading, resolver rejection, missing file, null key, Image onError, and a later successful revision. Every affected draft stays visible and openable.
- Verify row accessibility labels distinguish amount from unknown, provide the transaction date, and identify the open action. Check touch targets and flexible layout with existing controls.
- Open Drafts while Transactions has a past period, category, account, or quality filter. The inbox still includes all active drafts and does not alter those filters.
- Prove notifier, focus, foreground, and fresh-mount reads. Resolve promises out of order and after unmount; stale reads must not restore a completed or deleted row. Verify subscription cleanup.
- Complete and partially save through the existing editor, then assert the destination and refreshed inbox. Confirm and cancel deletion. Rapid duplicate actions must retain the existing single-write behavior.
- Inject navigation failure after completion or deletion and retry navigation. Assert no second write. Test default, valid, invalid, and array-valued from parameters.
- Open a stale link to a completed, deleted, or missing row and verify the existing editor or unavailable state with an inbox return path.
- Preserve direct Transactions editor navigation and existing completion recovery tests. Verify the web route never opens native ledger or photo storage.

## Execution stages and commits

Commit each stage locally after its checks pass. Do not push without your consent. Keep each stage under 800 changed lines and each complex logic stage under 500, counting tests. Split tests into further coherent commits if required; do not omit failure cases to meet a size target.

### Stage 1. Start the task and add the draft read API

1. Run taskroot validate, taskroot list, and taskroot context app:CAPTURE-005 --format json. Confirm CAPTURE-004 is Done and CAPTURE-005 is ready.
2. Run taskroot help start, then taskroot start app:CAPTURE-005. Validate immediately. Keep acceptance criteria unchecked.
3. Write database cases for visibility, null preservation, order, and prior-period recovery in tests/draft-inbox.database.test.ts.
4. Implement the small read service and compose it through database.ts and both ledger-access platform files. Use existing schema and transaction decoding.
5. Run the new database suite, transaction read regressions, typecheck, taskroot validation, and diff checks.

Commit: feat(capture): expose active drafts across periods

### Stage 2. Build the inbox view and photo rows

1. Add the narrow contract, DraftInboxView, and DraftInboxRow using FlatList, existing controls, safe areas, formatVnd, and PhotoThumbnail.
2. Add tests/draft-inbox.component.test.tsx for mixed amounts, empty/error/loading states, independent photo failures, and row navigation callbacks.
3. Keep the view dependency-injected so no SQLite or native file imports enter component code. Verify known-only rows and prior-period dates.
4. Run inbox, photo-thumbnail, and relevant presentation component tests plus typecheck.

Commit: feat(capture): render draft inbox states and thumbnails

### Stage 3. Connect durable reads and refresh lifecycle

1. Implement useDraftInbox with request generations, committed transaction subscription, focus and foreground refresh, retry, and cleanup.
2. Add /drafts native and web routes. Inject data and photo resolution at the route boundary. The web route explains installed-app availability and provides navigation.
3. Add tests/draft-inbox-route.component.test.tsx for initial read, invalidation, race handling, unmount, fresh mount, foreground, and browser isolation.
4. Run the route and view suites, typecheck, and web export. Check that route discovery does not import SQLite into the browser runtime.

Commit: feat(capture): refresh drafts from committed ledger changes

### Stage 4. Wire entry points and editor return navigation

1. Add a permanent Drafts action to Home and Transactions in every load state. Wire the existing Home unknown badge to the same route without changing its count source.
2. Add the allowlisted return helper and tests/draft-return-route.logic.test.ts. Pass from=drafts from inbox row links.
3. Update the existing editor route and terminal return label to use the resolved destination for save, complete, delete, and navigation retry. Provide an inbox return from unavailable/error states.
4. Extend Home, Transactions, editor-route, and router-navigation tests for both entry points, known-only drafts, active filters, successful mutations, and navigation failure after commit.
5. Run the affected logic/component suites and typecheck. Split navigation wiring and its wider router regressions into separate commits if the complex-change limit would be exceeded.

Commit: feat(capture): connect draft navigation and editor return

### Stage 5. Prove mutation, snapshot, and restart recovery

1. Add tests/draft-inbox-snapshot.integration.database.test.ts for partial saves, completion, deletion, exact amounts, unknown counts, income maintenance, rollback, and publication-only retry.
2. Add tests/draft-inbox-restart.database.test.ts using a real file-backed database and fresh services after close/reopen. Reuse tests/support/sqlite-proxy.ts and applicable draft-completion fixtures.
3. Extend editor/route tests only for gaps in inbox deletion or return behavior. Reuse established completion-recovery coverage rather than duplicating its implementation tests.
4. Run focused suites, then the full local gate below. Review every criterion against its evidence and preserve any unresolved failure explicitly.

Commits, split as needed:

- test(capture): verify draft inbox mutations and snapshots
- test(capture): verify draft inbox recovery after restart

### Stage 6. Record iPhone evidence and close

1. Add docs/build/draft-inbox.md with tested revision, local command results, workflow URL, IPA artifact/build identity, device model/iOS version, and the matrix below. Mark unobserved native results PENDING.
2. Use the existing GitHub Actions development IPA process with the widget disabled. Obtain consent before pushing commits; use CI for the iOS build. Do not attempt local Xcode or simulator work on this host.
3. Run the matrix on the identified device candidate. Record failures and fixes against their actual revisions. The CAPTURE-004 pending native checks remain explicit until separately observed.
4. Check acceptance items only against recorded evidence. Run taskroot validate, taskroot done app:CAPTURE-005, taskroot validate, taskroot list, and taskroot show app:CAPTURE-005 when verification is complete. If required device checks remain unavailable, record that fact and keep the task In Progress unless you explicitly direct closure with those checks pending.

Commit: docs(capture): record draft inbox verification

## iPhone verification matrix

| Scenario | Procedure | Expected result |
| --- | --- | --- |
| Both entry points | Open Drafts from Home, its unknown badge, and Transactions with filters active. | All routes show the same active drafts across periods; transaction filters stay unchanged. |
| Known and unknown | Capture once with 45,001 and once with Skip amount; open Drafts. | Exact amount and Unknown amount stay distinct and both photos can load. |
| Known-only inbox | Complete or delete the last unknown while retaining a known draft. | Home's unknown badge clears and the permanent Drafts action still opens the known draft. |
| Partial save and completion | Open a draft, save incomplete changes, reopen, then supply amount and leaf. | The same row persists after partial save and disappears after completion; return lands in Drafts. |
| Delete and cancel | Cancel deletion once, then confirm it. | Cancel preserves the draft; confirmation removes it and refreshes Home's count. |
| Missing photo | Open a fixture with unavailable retained bytes. | Explicit fallback appears; reopening, completing, and deleting still work. |
| Restart and offline | Capture known and unknown drafts, use airplane mode, force-quit, and reopen. | SQLite restores both rows and photo keys; Home publishes the correct unknown count. |
| Navigation and lifecycle | Return from the editor, background/foreground the app, and repeat quick taps during a write. | No duplicate writes or stale restored rows; actions remain reachable. |
| Display and scrolling | Browse a longer list with larger text and VoiceOver. | Amount states and actions remain readable; scrolling and safe areas preserve access. |

Use automated fault injection for deterministic database, snapshot, and navigation failures. A normal device run does not establish those cases.

## Verification commands

During each stage, run the existing and new suites touched by that stage with --runTestsByPath. After the named files exist:

```bash
npm run test:database -- --runInBand --runTestsByPath tests/draft-inbox.database.test.ts tests/draft-inbox-snapshot.integration.database.test.ts tests/draft-inbox-restart.database.test.ts
npm run test:component -- --runInBand --runTestsByPath tests/draft-inbox.component.test.tsx tests/draft-inbox-route.component.test.tsx tests/home.component.test.tsx tests/transaction-editor-route.component.test.tsx
npm run test:logic -- --runInBand --runTestsByPath tests/draft-return-route.logic.test.ts
npm run typecheck
taskroot validate
git diff --check
git diff --stat
```

Run the full local gate after implementation:

```bash
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

The exports check JavaScript bundling. GitHub Actions and the installed iPhone candidate establish native build and runtime evidence. No dependency or app configuration change is planned; revisit compatibility and prebuild checks if implementation changes that assumption.
