# CAPTURE-003 execution plan

Date: 2026-09-15

Task: [Capture a photo as a saved draft](../../.tasks/app/CAPTURE-003-capture-a-photo-as-a-saved-draft.md)

## Outcome and readiness

From Home, you can open the back camera, take one purchase photo, enter a positive whole-dong amount or skip it, and return to Home only after the retained photo and draft row are durable. A skipped amount stays `null` and causes the next snapshot to report one more unknown. Retrying an uncertain write cannot create a second draft.

The local implementation and automated evidence through Stage 5 are complete. CAPTURE-003 remains In Progress because Stage 6 requires a CI-built iPhone candidate. Native permission, keyboard, lifecycle, restart, and timing results remain pending. No device success is claimed by the local checks.

Use `CONTEXT.md`, `docs/spec/carryover-v1.md`, `docs/state-and-validation.md`, `docs/app-stack-and-testing.md`, `docs/DESIGN.md`, and the CAPTURE-002 plan as contracts. Correct money and an honest saved state take priority over the two-second target.

## Scope and handoff

CAPTURE-003 owns:

- the Home entry point and an Expo Router capture route;
- camera permission, camera readiness, and one back-camera still image;
- a focused VND input with explicit Done and Skip amount actions;
- the sequence from camera cache URI to prepared photo, retained photo, and SQLite draft;
- a capture-specific, idempotent database write using the route draft id;
- cancellation, backgrounding, retry, duplicate-submit protection, and navigation after commit;
- invalidation through the existing ledger notifier and snapshot publisher;
- local logic, database, component, and route tests;
- an iPhone runbook and recorded device results.

Keep these neighboring outcomes outside this task:

- CAPTURE-002 owns compression, stable photo keys, staging cleanup, retained-file resolution, and missing-photo presentation.
- CAPTURE-004 owns adding a leaf and promoting a draft to complete.
- CAPTURE-005 owns the draft inbox.
- CAPTURE-006 owns local notifications.
- UI-029 owns the later visual overhaul, capture choreography, and presentation refinement.
- Widget and shortcut launchers are later entry points. This task makes the route deep-linkable but does not build those launchers.

Do not add photo-library access, OCR, a category picker, account picker, date picker, camera roll save, flash controls, camera switching, image bytes in SQLite, a second snapshot path, or a capture Zustand store. The route and its local component state cover one active capture. SQLite remains the owner after commit.

No ledger migration is required. `transactions.id`, `status`, nullable `amount`, and nullable `photoKey` already support this outcome.

## Existing implementation and required changes

| Location | Reuse and required work |
| --- | --- |
| `src/app/index.tsx` and `HomeSnapshotView.tsx` | The native Home route already owns navigation, and the Capture button is present but disabled. Pass an `onCapture` action on native and keep the browser preview explicit and disabled. |
| `src/app/_layout.tsx` | The migration gate already prevents routes from opening the ledger too early. Register capture presentation only if route-specific options are needed. |
| `src/data/schema.ts` | Use the existing transaction columns and UUID primary key. Do not add a capture table or photo URI column. |
| `src/data/transaction-validation.ts` and `money-validation.ts` | Reuse the draft union and `draftVndInputSchema`. Blank text must become `null`; zero, fractional notation, exponential notation, and unsafe integers must fail. |
| `src/data/database.ts` and `atomic.ts` | Construct the capture write service with the existing serialized native transaction runner. Prepare the current period and insert the draft in one SQLite transaction. |
| `src/data/period-preparation.ts` | Prepare the current period before inserting, matching the manual transaction boundary. A capture is an expense, so it does not update stored income. |
| `src/data/ledger-change-notifier.ts` | Notify only after commit. The existing snapshot publisher will reread SQLite, call `computeBudget`, write shared storage, and publish that exact snapshot to the app store. |
| `src/photos/photo-access.ts` | Call `preparePhoto`, `retainPhoto`, and `discardPreparedPhoto`. Never write a key until retention succeeds, and never delete a retained file after a database failure. |
| `src/ui/Input.tsx` and `Button.tsx` | Reuse these controls for the amount, shutter, Done, Skip amount, retry, permission, and dismiss actions. |
| `src/ui/motion-plan.ts` | Use the existing `captureSaved` intent only for presentation after a committed save. Reduced motion must make it instant. Do not animate or interpolate an amount. |
| `package.json` and `app.config.js` | Add the SDK 57 compatible `expo-camera` package and its config plugin with a clear camera permission message. Disable unused barcode and audio behavior where the plugin supports it. |
| `tests/` | Follow the existing logic, real SQLite, and React Native Testing Library projects. Mock the camera edge, not the money or database rules. |

Expo SDK 57 currently maps `expo-camera` to `~57.0.5`. Install it with `npx expo install expo-camera` rather than pinning a recalled version. The official camera API supplies `CameraView`, `useCameraPermissions`, `takePictureAsync`, and the iOS `active` prop. It also requires that only one preview is active. See the [Expo Camera reference](https://docs.expo.dev/versions/latest/sdk/camera/).

## Route identity and recovery

Use `/capture/[draftId]` as the native route. Home generates one lowercase UUID v4 with the already-installed `expo-crypto` dependency and pushes that typed route. The route parses exactly one UUID parameter before camera or ledger work. Its browser sibling renders an installed-iPhone explanation and imports neither the ledger nor `expo-camera`.

The route parameter is the client-assigned transaction id and the idempotency key. It is not copied into Zustand. The retained photo keeps its independent CAPTURE-002 key, so the photo key does not become a transaction id and does not violate the storage contract.

On route mount:

1. Parse `draftId`. An invalid id shows a recoverable route error with a Home action and opens neither camera nor ledger mutation code.
2. Read the transaction with that id, including soft-deleted rows, before requesting permission. If no row exists, continue to camera capture.
3. If the row is the captured draft for this route, treat persistence as already complete and return to the existing Home route without another camera call or insertion. Replace with `/` only when a cold deep link has no prior route.
4. If the id belongs to a complete, deleted, or incompatible transaction, show an identity-collision error. Never overwrite it and never claim capture success.
5. Ignore a late read after unmount or after a newer route id replaces the request.

This read closes the uncertain-commit case. If SQLite committed before an exception or process termination, reopening the same route observes the row. If SQLite did not commit, the same id remains safe to retry. A retained photo with no committed row may remain unreferenced after process termination, as defined by CAPTURE-002. Do not sweep or reuse it in this task.

## Capture draft write boundary

Add a small capture-specific data service instead of weakening manual creation. Suggested modules are `src/data/captured-draft-validation.ts` and `src/data/captured-drafts.ts`.

The strict input shape is:

```ts
type CreateCapturedDraftInput = {
  draftId: string;
  photoKey: PhotoKey;
  amount: string | number | null;
  occurredAt: Date;
};
```

Validate it before opening a transaction. Parse `draftId` as a UUID, `photoKey` with the CAPTURE-002 key schema, `amount` with `draftVndInputSchema`, and `occurredAt` as a valid date. The screen should pass text so BigInt-backed validation runs before conversion. A blank Skip amount action passes `null` explicitly.

Within the existing atomic runner:

1. Capture one `now` value for the operation.
2. Reject an `occurredAt` later than the current local date using the shared manual-date rule. The shutter timestamp, not the later retry time, is the transaction time.
3. Find the one active default account by `isDefault`. Require exactly one. Do not identify Bank by its editable display name.
4. Call `prepareCurrentPeriodInTransaction` before insertion. This preserves the opening snapshot if the first capture occurs after a period rollover.
5. Insert one transaction using `draftId` as `id`, the active default account, `direction: 'expense'`, `adjustmentEffect: null`, parsed `amount`, `categoryId: null`, `quality: null`, payer you, the retained `photoKey`, the shutter time, `status: 'draft'`, and null note and source label.
6. Use an id-conflict-safe insert. When the id already exists, read it in the same transaction and accept it only when every capture-owned field matches the validated request. Return a discriminated `created` or `existing` result.
7. Reject a mismatched collision with context. Do not edit the existing row to make the retry appear valid.
8. Return only after the transaction commits. Notify `month_config` when preparation changed it, then notify `transactions:created` only for a new row. An accepted replay emits no second transaction event.

The route may report success only after it receives and validates the returned draft. Notification listeners cannot turn the committed write into a failure. If snapshot shared-storage publication later fails, Home uses its existing error and retry state. The capture route must not reinsert the draft or re-retain the photo.

## Screen and camera behavior

Split the native edge from the reusable capture view. Keep `expo-camera`, app-state, focus, and Router imports in the route or a thin native adapter. Give the component injected functions for photo preparation, retention, draft creation, and navigation so component tests never need a physical camera.

Model operation state as a discriminated union. At minimum it needs permission-loading, permission-denied, live, taking, reviewing, preparing, retaining, writing, failed, and saved states. Keep amount text as local form state. Do not represent mutually exclusive operations with unrelated booleans or optional handles.

The happy path is:

1. Check permission on entry. If status is undetermined, request it once. Never loop the system prompt.
2. If permission is granted and the route is focused and active, mount one back-facing `CameraView`. Keep its shutter disabled until `onCameraReady` fires.
3. Focus the amount input when the camera becomes ready. Use `keyboardType="number-pad"`, numeric input mode, `autoCorrect={false}`, and a visible currency label. Keep the shutter and dismiss controls reachable above the iOS keyboard.
4. On the first shutter press, lock duplicate presses and call `takePictureAsync` without base64 or EXIF. Record `occurredAt` when acquisition succeeds.
5. Replace the preview with the returned local image so the frame stays visible. Start `preparePhoto` immediately with an `AbortController` while the user types or chooses Skip amount.
6. Done validates the current nonblank amount. Skip amount ignores any typed text by explicit user choice and supplies `null`. Neither action asks for confirmation.
7. Await the one preparation already in flight. Retain its prepared handle. Only a retained result may cross into the captured-draft data service.
8. Submit the route id, retained key, selected amount, and shutter time once. Keep the source image and amount visible while work is pending. Use no blocking confirmation dialog, success toast, or spinner.
9. After commit, run the existing reduced-motion-aware `captureSaved` presentation and return to the existing Home route. Use back when navigation history exists and replace with `/` only for a cold deep link, so success cannot leave duplicate Home routes. The navigation step is the success signal.

The numeric input accepts digits only as editable text but the data boundary remains authoritative. Do not format through floating point. Do not insert separators into a value that will later be parsed ambiguously. Field feedback explains invalid zero, fractional, exponential, and over-limit values without discarding the typed text.

## Permission, cancellation, background, and retry matrix

| Event | Required result |
| --- | --- |
| Permission is loading | Render a neutral camera-loading state. Do not infer denial and do not write. |
| First permission request is denied but can be asked again | Show why the photo is needed, Retry permission, and Cancel. No camera, photo operation, or draft write runs. |
| Permission is permanently denied | Show Open Settings and Cancel. Recheck permission when the app becomes active. Do not report success. |
| Route loses focus or app backgrounds before shutter | Set the iOS camera `active` prop false or unmount it. Preserve the route and amount text. Resume only after focus and active state return. |
| Camera returns no photo or throws | Return to a retryable live-camera error. No photo preparation or draft write runs. |
| User cancels before shutter | Leave the route. No file or database mutation occurs. |
| User cancels while taking or preparing | Abort preparation, await camera or store cleanup, discard only a returned prepared handle, then leave. Ignore late callbacks. |
| User cancels after preparation but before retention | Call `discardPreparedPhoto`, await its result, then leave. Cleanup failure is shown and retryable rather than reported as success. |
| Route removal is attempted during retention or SQLite write | Prevent removal until the terminal operation settles. Disable shutter, amount edits, Done, Skip amount, and dismiss actions. |
| App backgrounds during retention or write | Let the non-cancellable boundary settle, but do not navigate while inactive. On foreground, reconcile by route id before showing retry or returning Home. |
| Preparation or retention fails | Keep amount text and the camera source. Retry photo processing from that source when readable, or offer Retake when it is unavailable. No draft is inserted. |
| SQLite definitely fails after retention | Keep the retained key and amount in the route. Retry only the idempotent database operation. Never encode or retain a second copy for that retry. |
| SQLite outcome is uncertain | Read by route id first. Accept only the exact matching captured draft; otherwise retry the same id or show a collision error. |
| Snapshot publication fails after commit | Return Home to its existing snapshot error state. Retry publication from committed data. Never repeat capture persistence. |
| Navigation fails after commit | Show a saved state with a Retry Home action. The action performs navigation only. |
| Process terminates after commit | Startup publication reads the durable draft. Reopening the restored route id reads the existing row and cannot duplicate it. |

Retaking abandons the current temporary or prepared source only after CAPTURE-002 cleanup finishes. It keeps the same route id because no draft has committed. Once retention succeeds, Retake is unavailable. A database retry must keep that retained key.

## Tests and evidence

### Logic tests

Add `tests/captured-draft-validation.logic.test.ts` for:

- blank and whitespace amounts becoming `null`;
- positive whole dong, one dong, and `MAX_VND_AMOUNT` succeeding exactly;
- zero, negative text, decimal text, exponent notation, separators, non-digits, unsafe values, `NaN`, and infinity failing;
- valid and invalid route UUIDs and photo keys;
- shutter dates later today succeeding and tomorrow failing by local calendar;
- capture state transitions rejecting duplicate shutter, duplicate save, save before retention, and edits after write starts.

### Database tests

Add `tests/captured-drafts.database.test.ts` with migrated SQLite and the public capture service. Cover:

- unknown and known expense drafts using the active default account and exact retained photo key;
- every non-capture field staying at its required neutral value;
- an unknown remaining `null` after close and file-backed reopen;
- a known amount remaining the same integer after reopen;
- first capture in a new period preparing `month_config` before insertion;
- repeated and concurrent calls with the same route id returning one row;
- a replay after a simulated uncertain result returning the existing matching row;
- the same id with another amount, photo key, time, account, status, or direction failing without mutation;
- invalid amount, missing default account, two active defaults, and injected SQL failure rolling back with no transaction notification;
- database failure after photo retention leaving the retained photo resolvable for retry.

Add `tests/capture-snapshot.integration.database.test.ts`. Start the real snapshot publisher against the test notifier, then assert:

- a skipped amount publishes `unloggedDrafts + 1` and does not subtract zero or any invented amount;
- a known draft subtracts its exact amount through the existing budget engine and does not increment unknowns;
- the artifact written to snapshot storage is the exact object placed in the ready store;
- a rejected mutation writes and publishes nothing;
- an accepted replay publishes no second ledger mutation;
- snapshot write failure after commit leaves one durable draft and recovers through publisher retry.

### Component and route tests

Add `tests/capture.component.test.tsx` and `tests/capture-route.component.test.tsx` with deferred promises and injected adapters. Cover:

- Home creates one draft id per press and routes to capture; the browser Capture button stays unavailable;
- invalid and already-committed route ids never open the camera;
- permission loading, request, denial, permanent denial, Settings return, and cancellation;
- one active back camera, camera-ready shutter gating, and amount focus with the numeric keypad configuration;
- frozen-photo review, Done with a valid amount, and one-tap Skip amount with `null`;
- invalid amount feedback without photo retention or a database call;
- duplicate shutter and Done presses while promises are pending;
- preparation, retention, and database failures preserving the correct retry material;
- database retry using the same draft id and retained key without another photo call;
- cancellation cleanup before retention and route-removal prevention during terminal work;
- background and foreground at live, preparing, writing, and saved boundaries;
- committed navigation failure offering navigation-only retry;
- unmount and route-id changes ignoring late asynchronous results;
- the committed path navigating only after retention and SQLite resolve.

Use deterministic camera URIs and CAPTURE-002 fixtures. Do not use arbitrary timers or sleep. Deferred promises make every race controllable.

## Execution stages and commits

Commit each stage after its focused checks pass. Keep new modules below 400 lines. Keep each complex stage below 500 changed lines and other nonmechanical stages below 800. Split a stage before continuing if it exceeds those limits. Do not push or dispatch GitHub Actions without user consent.

### Stage 1. Start the ready task and add the draft write boundary

1. Finish CAPTURE-002 first. Run `taskroot validate`, `taskroot list`, and `taskroot context app:CAPTURE-003 --format json`.
2. Confirm CAPTURE-003 has no readiness blockers, then run `taskroot start app:CAPTURE-003`.
3. Write the validation and database tests first.
4. Add the strict capture input schema and idempotent atomic service.
5. Wire the service in `src/data/database.ts` and expose a narrow capture contract through `src/ui/ledger-access.ts` and its web boundary.
6. Run the focused logic and database tests, transaction and amount regressions, typecheck, task validation, and diff-size checks.

Commit: `feat(capture): persist captured drafts idempotently`

### Stage 2. Add the native camera boundary and route identity

1. Run `npx expo install expo-camera` and confirm the installed version matches Expo SDK 57.
2. Add the `expo-camera` config plugin with a specific iOS camera explanation. Do not request photo-library access.
3. Add route-id parsing, `/capture/[draftId].tsx`, and its `.web.tsx` fallback.
4. Enable native Home capture by generating a UUID and pushing the typed route. Keep web explicit and unavailable.
5. Add route tests for valid, invalid, existing, and colliding ids before rendering a camera.
6. Run focused component tests, `npx expo install --check`, `npm run doctor`, typecheck, task validation, and both web and iOS JavaScript exports.

Commit: `feat(capture): route Home into the iPhone camera`

### Stage 3. Build the camera and amount interaction

1. Write component tests for permissions, camera readiness, focus, shutter locking, frozen review, amount validation, Done, and Skip amount.
2. Add the thin `CameraView` adapter and capture component using shared controls.
3. Start one photo preparation after shutter and keep its promise and `AbortController` tied to the current route id.
4. Add the no-spinner pending presentation and explicit accessible labels and hints.
5. Keep all money parsing in the shared schema path.
6. Run focused logic and component tests, typecheck, exports, task validation, and diff checks.

Commit: `feat(capture): photograph purchases with an optional amount`

### Stage 4. Complete durability, cancellation, and retry

1. Write deferred-promise tests for every row in the failure matrix.
2. Connect preparation to retention and the capture data service in the required order.
3. Add immediate duplicate-submit locks, route-removal protection, cleanup-aware cancellation, and background reconciliation.
4. Separate photo retry, database retry, snapshot retry, and navigation retry so each repeats only its failed boundary.
5. Add the reduced-motion-aware committed transition and history-aware Home return.
6. Run focused component, route, photo-store, and database tests, typecheck, task validation, and diff checks.

Commit: `feat(capture): recover capture without duplicate drafts`

### Stage 5. Prove snapshot and restart behavior

1. Add the capture snapshot integration suite using the existing publisher and real SQLite.
2. Add a file-backed restart test that closes and reopens SQLite while resolving the same retained photo through a recreated store.
3. Assert exact known-draft spending, explicit unknown count, period snapshot preservation, event counts, and writer/store identity.
4. Run all money, transaction, budget, snapshot, photo, and capture suites, then the full Jest suite and Python tests.
5. Run `npm run typecheck`, `npx expo install --check`, `npm run doctor`, production web export, iOS JavaScript export, and clean iOS prebuild. Confirm the generated Info.plist contains the intended camera text and no photo-library permission added by this task.

Commit: `test(capture): prove durable draft publication and recovery`

### Stage 6. Build and verify on the iPhone

1. Add `docs/build/capture-draft.md` with the revision, workflow run, IPA artifact, phone and iOS version, permission state, scenario results, and timing table.
2. After user approval, push the tested commit and dispatch the existing development IPA workflow with the widget disabled.
3. Install that exact candidate. Run the device matrix below, record results, and fix failures in focused commits with another candidate.
4. Check only criteria supported by local and device evidence.
5. Run `taskroot validate`, full tests, and typecheck. Run `taskroot done app:CAPTURE-003` only when all four criteria are checked, then validate and inspect `taskroot show app:CAPTURE-003`.

Commit: `docs(capture): record saved draft verification`

## iPhone verification matrix

Use a fresh development install for first-permission behavior and the exact CI-built revision for every result.

| Scenario | Procedure | Pass condition |
| --- | --- | --- |
| Permission allow | Open Capture on a fresh install and allow camera access. | The configured explanation appears once, one back-camera preview opens, and no photo-library prompt appears. |
| Permission deny | Fresh-install again, deny access, retry where allowed, then enable it in Settings and return. | No file or draft is created while denied. The route explains recovery and opens the camera after permission is granted. |
| Keyboard and safe area | Open Capture with permission granted, rotate the phone physically while the app stays portrait, and test normal and larger text. | The amount remains focused on a numeric keypad. Shutter, Skip amount, Done, and dismiss stay visible, tappable, and outside unsafe areas. |
| Unknown offline capture | Enable airplane mode, take a receipt photo, tap Skip amount, and return Home. | The flow has no network UI. Home shows exactly one additional unknown after the durable save. |
| Known offline capture | Still offline, capture `45,001` VND. | The draft stores exactly 45,001 and the Home snapshot changes by exactly 45,001 without incrementing unknowns. |
| Cancel and retake | Cancel before shutter, cancel after shutter, then fail and retry a photo operation through the available development fault path. | Cancelled attempts report no success and create no draft. Cleanup settles before exit. Retry creates one draft. |
| Background | Background in the live view, after shutter, and immediately after Done or Skip amount. Return each time. | No black or duplicate preview remains. Inputs survive when safe. A committed save returns Home once, and an uncommitted attempt never reports success. |
| Duplicate input | Tap shutter and Done or Skip amount rapidly several times. | One photo is retained for the accepted attempt and one transaction id is present. The unknown count changes at most once. |
| Restart recovery | Save an unknown, force-quit from Home, reopen, then inspect Home and Transactions. Repeat by force-quitting immediately after the save action. | The draft and unknown count survive. Restored navigation or retry cannot add a second row. |
| Snapshot failure recovery | Use the existing shared-storage failure probe or a development-only injected failure if one is required. | The draft stays saved, Home shows snapshot unavailable, and Try again republishes from SQLite without another draft. Remove any task-specific fault control before release. |
| Capture time | With permission already granted and airplane mode on, screen-record at least ten Skip amount captures. Measure Home Capture tap to camera-ready and shutter tap to Home return separately. | Report median and slowest values. The warm shutter-to-Home median is at or below 2.0 seconds. Any miss is investigated before accepting the criterion. |

Inspect every retained sample for readable receipt text and correct orientation. Record processing time and final bytes beside the end-to-end timing so a slow camera, encoder, file promotion, or SQLite boundary can be distinguished. Correctness failures block completion even if timing passes.

## Final verification commands

Run focused tests during each stage. Run this full gate before checking the task criteria:

```bash
npm run typecheck
npm test -- --runInBand
python3 -m unittest discover -s tests -p '*_test.py'
npx expo install --check
npm run doctor
npm run web:export
npx expo export --platform ios
CARRYOVER_VARIANT=development npm run prebuild
taskroot validate
taskroot context app:CAPTURE-003 --format json
git diff --check
git status --short
```

The web export verifies that route discovery does not pull `expo-camera` or SQLite into the browser fallback. The iOS export verifies JavaScript bundling only. The clean prebuild verifies native module and permission generation on Linux. Only the GitHub Actions macOS build and installed iPhone candidate prove native compilation and real camera, permission, keyboard, lifecycle, file, and timing behavior.
