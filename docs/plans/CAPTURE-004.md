# CAPTURE-004 execution plan

Date: 2026-09-16

Task: [Complete drafts with searchable leaf selection](../../.tasks/app/CAPTURE-004-complete-drafts-with-searchable-leaf-selection.md)

## Outcome and readiness

You can open a saved draft, see its retained photo, enter a positive whole-dong amount, select or create a leaf, and complete the same transaction. You can leave quality, account, date, and note untouched. Completion preserves the transaction id and photo key, updates the ledger once, and lets the existing snapshot publisher refresh the unknown count and budget figures.

CAPTURE-003 and UI-002 are Done. Taskroot reports CAPTURE-004 ready with no blockers. CAPTURE-003 was closed at your request with detailed and native checks deferred; that closure is not evidence of an iPhone pass. CAPTURE-004 remains To Do while this plan is written. Start it only when implementation begins.

Use CONTEXT.md, docs/state-and-validation.md, docs/app-stack-and-testing.md, docs/spec/period-income-policy.md, and the existing transaction and category APIs as contracts. Use the current UI controls. The visual overhaul belongs to milestone 0.9.0.

## Current implementation and gaps

| Existing code | What to reuse | Gap to close |
| --- | --- | --- |
| src/app/transactions/[transactionId].tsx | UUID validation, public transaction read, account and category loading, unavailable states | Inject photo resolution and category creation; refresh choices without remounting the form; reset correctly when the route id changes. |
| src/ui/transactions/TransactionEditor.tsx | Draft editing, completion dispatch, validation, immediate duplicate-submit lock | Show the photo, compose searchable selection and inline creation, separate committed success from navigation failure. |
| src/ui/transactions/transaction-form.ts | Initialization, integer amount parsing, local-date validation, changed-field and completion payloads | Add only narrowly needed helpers and regression tests. Do not copy this logic into a second draft form. |
| src/ui/transactions/TransactionFormFields.tsx | Controlled amount, direction, account, quality, date, and note fields | Replace the flat leaf button list with a reusable searchable selector. |
| src/data/manual-transactions.ts | Atomic completion, active account and leaf checks, period preparation, current income maintenance | Prove capture completion through this boundary. Keep it as the write path. |
| src/data/transactions.ts | Same-row promotion, optimistic concurrency, photo preservation | Preserve rejection of already-complete rows; recover uncertain outcomes above this repository. |
| src/data/categories.ts and category-validation.ts | Two-level category creation, validated names, active group checks, inherited leaf kind | Expose the existing create operation through a narrow editor contract. |
| src/ui/photos/PhotoThumbnail.tsx and src/photos/photo-access.ts | Retained-key resolution and explicit unavailable presentation | Render a useful photo size in the editor with an injected resolver. |
| src/budget/snapshot-publisher.ts | Publication from committed ledger data and publication-only retry | Add completion integration coverage; no screen budget arithmetic. |

The current editor already calls completeDraft when a draft has an amount and an expense leaf, or an amount and income direction. It otherwise offers Save draft. Keep that behavior. The manual boundary already enforces UI-020 and DATA-015. This task does not need a new completion table, a migration, a native dependency, or another budget implementation.

## Scope and product decisions

1. Use /transactions/[transactionId] for completion. Existing Transactions rows already open that route. CAPTURE-005 owns the dedicated draft inbox and Home links. Do not create a competing completion route or redirect successful capture into editing.
2. A complete expense requires a positive amount and an active leaf. Income requires a positive amount and has no category, as specified by the existing state contract. Switching to income clears the leaf; switching back requires leaf selection. Adjustments and transfers keep their existing behavior.
3. Optional account and date mean you need not change the captured account and date. They remain required stored values. Preserve them instead of replacing them with today's default bank or today's date. If the account is no longer active, show the boundary error and let you choose an active account.
4. Quality starts from the stored value, including null, and remains skippable in one tap. Empty optional note and income source use the existing normalization. Keep payer, creation time, id, and photo key out of editable payload fields.
5. Blank draft amount stays null when saved as a draft. Completion rejects blank, zero, negative, fractional, exponential, and unsafe amounts. Reuse money schemas and currency constants. Never pass an amount through floating-point conversion or formatting arithmetic.
6. Show the photo above the editable fields. Start with the existing PhotoThumbnail at a size that fits the viewport. An absent, unreadable, or missing file shows its explicit fallback and never prevents completing a valid transaction. Photo replacement, zoom, OCR, and file deletion are outside this task.
7. Keep search and creation inside the editor. Closing the category form changes no transaction input. Persist categories when their own Create action succeeds; leaving the draft afterward does not delete the new category.
8. Preserve Save draft for partial edits. Keep validation feedback next to the relevant field. Completing a draft must never require choosing a quality or changing another optional field.

## Search and inline creation contract

Build a small shared selector in src/ui/categories. Keep its data input as active groups with their leaves, selected leaf id, disabled state, and selection callback. It must work without a creation API so the manual creator can reuse search while the editor supplies inline creation. Use a discriminated capability prop for selection-only versus creation-enabled behavior.

Search is local and deterministic. Trim the query, normalize case and Unicode accents, and map Vietnamese đ to d for matching. Match leaf names and group names; a matching group exposes its leaves. Keep the stored group and leaf order within results. An empty query restores all active choices. Preserve the selected leaf when it is filtered out and display its name separately. Show the group name so identical leaf names remain distinguishable. Search never writes or auto-selects a result. Groups are headings and creation destinations, never transaction choices. Ranking by usage is outside this stage.

Provide New group and New leaf actions, including when there are no results or no categories. A new group asks for name and kind, with spend selected initially and reserve available through the existing kind control. A new leaf asks for name and an active group; its kind comes from that group. Validate names with categoryNameSchema and writes with createCategoryInputSchema. Do not add a name uniqueness rule that the current API does not enforce.

After group creation, keep the returned group id and open leaf creation under it. A group alone cannot satisfy expense completion. After leaf creation, merge the returned leaf into the visible choices, select its id, clear the query so it is visible, and close the creation form. Refresh the authoritative group list without resetting transaction inputs.

Keep creation and list refresh as separate operations. If creation succeeds but refresh fails, retain the returned category and show a retry for the read only. Do not repeat createCategory because a later read failed. If group creation succeeds and leaf creation fails, retain the group id and leaf input; retry only the leaf. Use an immediate ref lock as well as disabled buttons to prevent duplicate create calls while a request is pending.

Extract reusable category-name validation or creation fields from the Settings editor only when they would otherwise be duplicated. Do not transplant its whole screen or mutation lifecycle. Leave rename, reorder, kind changes, and deletion in Settings.

## Module and state ownership

| Proposed or changed module | Responsibility |
| --- | --- |
| src/ui/categories/leaf-search.ts | Pure normalization and filtering, preserving stored order and identity. |
| src/ui/categories/LeafSelector.tsx | Search input, group headings, selected leaf, empty state, selection, and creation entry points. |
| src/ui/categories/InlineCategoryCreator.tsx | Group or leaf form, existing Zod name feedback, pending state, returned category, and retry boundaries. |
| src/ui/categories/leaf-selector-contract.ts | Narrow category data and discriminated selection or creation capability. |
| src/ui/transactions/transaction-editor-contract.ts | Add the existing typed createCategory operation to the editor facade. |
| src/ui/transactions/useTransactionEditorChoices.ts | Choice refresh and returned-category merging without replacing transaction form state. |
| src/ui/transactions/draft-completion-operation.ts | Frozen completion attempt, read-after-failure reconciliation, and success versus conflict outcomes. |
| src/ui/transactions/TransactionEditor.tsx | Own unsaved transaction values and compose the existing fields, photo, selector, and operation state. |
| src/ui/transactions/TransactionFormFields.tsx | Reuse LeafSelector for editable expenses; retain fixed reserve-payment leaf presentation. |
| src/app/transactions/[transactionId].tsx | Route identity, initial read, platform adapters, and navigation. |
| src/ui/ledger-access.ts | Forward category creation to categoryData and completion to manualTransactionData. |

These are proposed file boundaries, not a requirement to introduce empty wrappers. Keep modules below 400 lines where practical. transaction-form.ts already has 321 lines and transactions.ts has 362, so put new coordination in separate modules. Add no any types or non-null assertions.

React state owns unsaved values, query, and inline creation. SQLite owns durable categories and transactions. Route identity owns the active transaction id. A category change notification refreshes category choices only, without reloading the transaction or entering the route's initial loading state. Keep the editor mounted during refresh and refresh failure. Key the editor by transaction id so navigating to another transaction cannot reuse the previous form.

Use request generations and cleanup for category/account refreshes. Ignore stale results after a newer refresh, route change, or unmount. Expose refresh errors with retry rather than silently catching them. Do not automatically discard an unavailable selected leaf; show feedback and let the existing active-leaf check reject completion until you choose a valid one.

While category creation is pending, disable transaction submission and direction changes so a late result cannot select a leaf on an income form. While transaction submission is pending, disable fields, creation, deletion, and duplicate submission. Protect route removal during the write using the existing capture pattern. Once a write commits, leaving the route is safe.

## Completion and recovery sequence

1. Validate the current form with validateTransactionForm using an injected clock and the captured date anchor. Build the payload with buildCompleteDraftPayload. Freeze the payload and expected resulting row for this attempt.
2. Call the editor facade's completeDraft, which delegates to manualTransactionData.completeDraft. Do not call the raw transaction service directly from UI code.
3. Inside the existing atomic boundary, validate stored references and local date, prepare the current period, promote the existing transaction, and maintain current income. A failure rolls back the entire mutation and publishes no completion notification.
4. After commit, allow the existing ledger notification to trigger snapshot publication. Record committed success before running navigation. Return to /transactions through the current route behavior.
5. If navigation throws, show a saved state with a navigation-only retry. Do not leave Complete enabled and call the write again.
6. If completion rejects, read the same transaction id before offering another write. If it is still the original active draft, preserve the input and offer retry with the same id. If its stored fields changed, show a conflict and require an explicit reload before another attempt.
7. If the read returns a complete row, compare it with the frozen expected result using a pure helper. Compare the id, amount, direction, category, account, quality, occurredAt timestamp, note, source, payer, adjustment effect, and photo key. Exclude database-owned updatedAt. An exact match is committed success. A different row is a conflict, never permission to overwrite it.
8. If reconciliation itself fails, keep the attempt and provide a read-only retry. A missing or deleted row is unavailable. Never fall back to createTransaction or generate another id.
9. If shared snapshot storage fails after commit, leave the transaction complete and use the existing Home publication error and retry. That retry reads committed data and writes the snapshot only.

The raw repository deliberately rejects a second completion. Keep that contract. The coordinator makes the user flow recoverable without weakening it or adding speculative persistence infrastructure. Save-draft editing retains the existing changed-field write path and must also separate a committed write from navigation failure.

## Acceptance evidence

| Task criterion | Required evidence |
| --- | --- |
| Photo and minimal completion | Component test opens a photo draft, adds amount and leaf, leaves quality null and captured account/date unchanged, and completes the same id. Missing-photo coverage proves completion remains available. |
| Search and inline creation | Pure search tests plus component tests cover leaf/group matches, accents, empty results, duplicate names across groups, new group then leaf, selection, cancellation, failed writes, and preserved transaction inputs. |
| Shared validation and snapshot | Real migrated SQLite tests call the manual facade and prove exact money, date rejection, current income maintenance, id/photo preservation, unknown removal, rollback, and publication retry. |
| Failure and retry | Deferred-promise component tests and database tests cover immediate duplicate taps, rejected writes, committed-but-rejected results, navigation failure, conflicts, category read failure after creation, and no inserted duplicate transactions. |

Add tests in tests/. Use deferred promises for controllable async races. Use migrated SQLite fixtures to verify actual storage behavior. Reuse tests/support/sqlite-proxy.ts and the setup patterns in capture-snapshot.integration.database.test.ts. Extract a small shared test fixture only if repeated setup justifies it.

Database and snapshot cases must include:

- An unknown expense draft completed for 45,001 VND: amount becomes exactly 45,001, status becomes complete, unknown count falls by one, and spending changes through the budget engine.
- A known expense draft already at 45,001 completed with the same amount: spending is not charged twice and unknown count remains unchanged. Also cover editing that amount during completion.
- Use a spend leaf for the exact-spending fixtures. Cover a reserve leaf separately through the existing reserve rules without inventing a new budget formula.
- Current-period expense draft completed as income: category becomes null, expense treatment is removed, and current month config income reflects the exact stored amount once.
- An income draft completed as an expense: current income is maintained by the same boundary. Past period config snapshots stay unchanged when completing or changing the date of a historical draft.
- Completion as the first mutation after local period rollover: period preparation and completion commit together. Future local dates fail; valid dates later today remain allowed under UI-020.
- Deleted/missing account, group id used as leaf, deleted leaf, and missing/deleted draft: no partial promotion, no partial income or config update, no completion event.
- Injected SQL failure and income overflow: transaction and period changes roll back together. Retained photo and id remain available for retry.
- Repeated completion and overlapping writes: no duplicate row, no second completion event, no restoration of draft status, and no stale overwrite.
- Snapshot publication failure after completion: one durable complete row remains. Retrying publication writes the same artifact to storage and the ready store without repeating completion.
- Close and reopen a file-backed database: complete status, exact amount, id, photo key, and optional values survive. Reopening the route presents the complete transaction.

## Execution stages and commits

Commit every stage after its checks pass. Keep complex changes below 500 changed lines and other nonmechanical changes below 800, counting tests. If a stage exceeds the limit, split it into another coherent passing commit before continuing. Do not push without your consent.

### Stage 1. Start the task and prove the existing completion boundary

1. Run taskroot validate, taskroot list, and taskroot context app:CAPTURE-004 --format json. Confirm both dependencies remain Done and there are no blockers, then run taskroot start app:CAPTURE-004.
2. Read the current code and this plan again for drift. Keep the income exception explicit in the task criteria.
3. Add tests/draft-completion.database.test.ts for minimal expense completion, income direction, id/photo preservation, invalid money, inactive references, and future-date rollback through createManualTransactionData.
4. Add only missing form cases to tests/transaction-form.logic.test.ts. If a regression fails, fix it at the existing shared boundary before adding UI.
5. Run the focused logic/database suites, npm run typecheck, task validation, and diff checks.

Commit: test(capture): specify draft completion boundary

### Stage 2. Add reusable searchable leaf selection

1. Write tests/leaf-search.logic.test.ts for normalization, Vietnamese input, group matches, empty query, filtered selection, and deterministic order.
2. Add leaf-search.ts, the selection contract, and LeafSelector using existing Input and Button components.
3. Replace the flat leaf choices in TransactionFormFields. Keep fixed reserve-payment presentation and income behavior unchanged.
4. Add tests/leaf-selector.component.test.tsx for accessibility, selection, no results, duplicate labels with group context, and disabled interaction.
5. Run those suites plus transaction-create and transaction-editor component regressions and typecheck.

Commit: feat(categories): search transaction leaf choices

### Stage 3. Add inline category creation with recoverable refresh

1. Extend TransactionEditorData and ledger-access with the existing typed createCategory operation; update test facades. Keep browser access behind the existing web boundary.
2. Add InlineCategoryCreator and the choice refresh hook. Share small category validation or form pieces with Settings if needed.
3. Wire New group and New leaf in the editor selector. Preserve every transaction field, use the returned category identity, and separate successful creation from list refresh.
4. Add tests/inline-category-creator.component.test.tsx for validation, duplicate tap locking, group-then-leaf flow, inherited kind, cancellation, write failure, and successful-create/failed-refresh retry.
5. Add editor coverage proving amount, date, account, note, quality, and selected leaf survive creation and refresh. Run category, editor, creator, route, and type checks.

Commit: feat(capture): create categories while completing a draft

### Stage 4. Show the retained photo and preserve route-owned input

1. Inject resolvePhoto from the native photo access boundary; shared components receive its typed resolver. Render PhotoThumbnail above the fields with useful sizing and explicit fallback.
2. Add category notification refresh without replacing the loaded transaction or remounting the editor. Retain current account refresh behavior while making cleanup and errors explicit.
3. Key the editor by transaction id and ignore stale photo/choice results. Use the draft heading Complete draft and preserve the existing partial Save draft action.
4. Add tests/draft-completion.component.test.tsx and tests/transaction-editor-route.component.test.tsx for minimal completion, quality skip, photo failures, invalid/missing routes, route-id changes, refresh errors, and preserved input.
5. Run the new suites, photo-thumbnail, navigation, editor, creator, and category regressions plus typecheck. Export web and iOS JavaScript to catch platform import mistakes.

Commit: feat(capture): show saved photos during draft completion

### Stage 5. Recover completion without a second write

1. Add tests/draft-completion-operation.logic.test.ts for a frozen attempt, same-row reconciliation, exact-match success, conflict, deleted row, and failed reconciliation read.
2. Implement the operation helper and discriminated editor submission states. Keep pending, failed/reconciling, committed, and navigation-failed states distinct.
3. Connect immediate submit locking, pending route-removal protection, read-before-retry, and navigation-only retry. Prevent category operations from racing transaction submission.
4. Extend component tests with deferred promises for duplicate completion, uncertain write outcome, navigation failure, unmount, route change, and category creation races.
5. Run operation, editor, route, transactions database, and completion database suites plus typecheck.

Commit: fix(capture): recover completion by transaction identity

### Stage 6. Prove money publication and durable recovery

1. Add tests/draft-completion-snapshot.integration.database.test.ts using the real manual boundary, notifier, publisher, writer, and store.
2. Add tests/draft-completion-restart.database.test.ts for close/reopen persistence using a captured draft with a retained key.
3. Cover unknown and known amounts, direction changes, period rollover, frozen historical config, rollback, event counts, and publication-only retry from the evidence list above.
4. Run focused completion, budget, amount, period-income, transaction, photo-retention, and snapshot suites. Run the full local gate below once these pass.
5. Review every criterion against the diff and evidence. Split this stage if its test fixtures and cases exceed the change-size limits.

Commit: test(capture): verify completion snapshots and restart recovery

### Stage 7. Record device evidence and close the task

1. Add docs/build/draft-completion.md with the exact revision, GitHub Actions URL, IPA artifact, device/iOS identity, and the device matrix below. Record PENDING until observed.
2. Use the existing development IPA workflow with the widget disabled. Get your consent before pushing or dispatching a new build. Never attempt a local Xcode build on this Linux host.
3. Run the matrix on that candidate and record actual results. Fix failures in focused commits, repeat the affected checks, and identify the replacement candidate.
4. Check task criteria only when the required evidence exists. CAPTURE-003's explicit deferral does not automatically waive CAPTURE-004 verification.
5. Run taskroot validate, taskroot done app:CAPTURE-004, taskroot validate, taskroot list, and taskroot show app:CAPTURE-004. If device evidence is unavailable, leave implementation progress and pending checks documented without claiming a pass.

Commit: docs(capture): record draft completion verification

## Device verification matrix

| Scenario | Procedure | Expected result |
| --- | --- | --- |
| Minimal completion | Capture with Skip amount, open its Transactions row, enter 45,001 and choose a spend leaf. Leave all optional fields untouched. | Photo is visible, quality stays unset, captured account/date stay unchanged, one row completes, and Home loses one unknown. |
| Known amount | Capture 45,001, reopen and choose a leaf without changing the amount. | Amount is exact and completion does not charge spending twice. |
| Inline creation | Enter optional fields, search a missing leaf, create a group then a leaf, and complete. | All transaction input survives and the newly created leaf is selected. |
| Search | Search group/leaf names with accents, without accents, and with no match; clear the query. | Results follow the documented matching rules and selected leaf identity stays stable. |
| Keyboard and text size | Use amount, search, and creation fields with normal and larger text. | Keyboard, safe areas, scrolling, and focus leave Create, Complete, and cancel actions usable. |
| Missing photo | Open a draft whose retained file is unavailable. | Explicit photo fallback appears and valid completion still works. |
| Invalid input | Try zero, fractional amount, and tomorrow's local date. | Clear feedback appears and the stored draft stays unchanged. |
| Direction | Change a current expense draft to income and complete with an amount. | Category is cleared, source stays optional, and current income/snapshot agree with the ledger. |
| Offline and restart | Complete in airplane mode, force-quit, and reopen its route. | The same complete transaction, amount, and retained photo survive. |
| Rapid input and lifecycle | Tap Complete repeatedly and attempt back/background while saving. | One completion commits; the route does not offer a second write after committed success. |

Use injected failures in automated tests for deterministic SQL, category-refresh, navigation, and snapshot failures. Do not claim that an ordinary device happy path proves these cases. Detailed CAPTURE-003 camera and timing checks remain in its own pending runbook.

## Verification commands

During each stage, select the relevant existing and new suites by filename. For example, after those files exist:

```bash
npm run test:logic -- --runInBand --runTestsByPath tests/leaf-search.logic.test.ts tests/transaction-form.logic.test.ts
npm run test:database -- --runInBand --runTestsByPath tests/draft-completion.database.test.ts tests/transactions.database.test.ts
npm run test:component -- --runInBand --runTestsByPath tests/leaf-selector.component.test.tsx tests/transaction-editor.component.test.tsx
npm run typecheck
taskroot validate
git diff --check
git diff --stat
```

Run the full local gate before native verification:

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

This plan adds no native packages or app configuration. Run dependency compatibility checks and a clean development prebuild only if implementation changes those assumptions. Web and iOS exports verify bundling, not native runtime behavior. GitHub Actions is the only iOS build environment, and the installed iPhone candidate provides keyboard, photo, and lifecycle evidence.
