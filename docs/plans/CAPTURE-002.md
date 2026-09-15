# CAPTURE-002 execution plan

Date: 2026-09-15

Task: [Store durable capture photos](../../.tasks/app/CAPTURE-002-store-durable-capture-photos.md)

## Outcome and readiness

You can retain a purchase photo under a stable key before a draft references it. The photo survives an app restart and transaction soft deletion. If its file becomes unavailable, you see that explicitly and your transaction amount stays unchanged.

CAPTURE-002 is To Do and ready. Its dependency UI-020 is Done. This plan leaves the task To Do and its criteria unchecked. Start it only when implementation begins.

Use CONTEXT.md, docs/spec/carryover-v1.md, docs/state-and-validation.md, and docs/app-stack-and-testing.md as the product and architecture contracts. The decisions below define the implementation; compression parameters remain subject to the specified iPhone measurements.

## Scope and handoff

This task supplies photo preparation, durable retention, key resolution, temporary-file cleanup, a reusable thumbnail, and deterministic failure tests. It also supplies a device verification procedure that can run before the capture screen exists.

CAPTURE-003 owns camera acquisition, permissions, the optional amount field, route cancellation, draft creation, duplicate-submit protection, and snapshot publication. CAPTURE-004 owns completion. CAPTURE-005 owns the draft inbox. CAPTURE-006 owns notifications. DATA-011 owns JSON export, and DATA-014 owns separate photo export. UI-029 owns the later presentation overhaul.

Keep those relationships unchanged. No schema migration, photo table, image bytes in SQLite, background upload, OCR, separate thumbnail files, or automatic deletion of retained photos is needed for this outcome.

## Existing implementation and gaps

| Location | Reuse and required work |
| --- | --- |
| src/data/schema.ts | transactions.photoKey is already nullable text. Store only a stable key here. |
| src/data/transaction-validation.ts | Draft and complete transactions already share a status union; a draft amount can be null. Preserve the stored schema's ability to read existing photo keys. |
| src/data/transactions.ts | Generic creation accepts drafts and photoKey. Completion and soft deletion already preserve that key. Exercise these operations in integration tests. |
| src/data/manual-transactions.ts | Manual creation accepts complete transactions only. It is not the capture creation API. Manual completion already supplies date validation and period preparation. |
| src/data/database.ts and src/data/atomic.ts | CAPTURE-003 must use the existing native transaction queue and period preparation when it implements the draft write boundary. File encoding must happen outside a SQLite transaction. |
| src/data/ledger-change-notifier.ts | Notifications describe committed ledger changes. Photo processing and thumbnail reads must not emit them. |
| src/budget/snapshot-source.ts and compute-budget.ts | Existing logic distinguishes known draft amounts and unknowns. Verify unchanged output when only photo availability changes. |
| src/ui/ledger-access.ts and ledger-access.web.ts | Follow the platform boundary pattern. Keep native photo dependencies outside shared components and browser imports. |
| package.json and package-lock.json | Expo SDK 57 is installed. expo-file-system is transitive; image manipulation and UUID generation need explicit supported dependencies. |
| tests/support/sqlite-proxy.ts and jest.config.js | Reuse migrated real SQLite and the logic, database, and component test projects. |

## Storage and ownership decisions

### Keys and directories

1. Generate a lowercase UUID v4 once per prepared photo. Use the relative key photos/v1/{uuid}.jpg. It contains no amount, transaction id, original filename, or absolute sandbox path.
2. Resolve that key against the current app document directory on every read. Keep partial output under a separate capture-staging directory in the same document directory. Never persist a cache URI or an absolute document URI in the ledger.
3. Validate generated keys with a strict photo-specific schema before resolving paths. Reject absolute paths, separators outside the specified structure, traversal, encoded traversal, and unsupported versions. Do not tighten the existing transaction read schema in a way that prevents older rows from loading. An unsupported stored key produces an unavailable photo.
4. Treat retained files as immutable. Create destinations without overwrite. A collision must preserve the existing file and fail with context; retry preparation with a new key.
5. Keep the store independent of SQLite. A prepared-photo handle identifies only files owned by that preparation. It grants no authority to delete an arbitrary source URI or retained file.
6. Retention means persistent app-local storage through normal restart and soft deletion. It does not promise survival after uninstall or an erased app container. JSON backup exclusion concerns the app's export format, not an additional operating-system backup policy.

Use the modern File, Directory, and Paths API, resolving the document root inside adapter calls. Expo documents the file operations used by this adapter in its [FileSystem reference](https://docs.expo.dev/versions/latest/sdk/filesystem/).

### Public contract and module layout

Add a small src/photos directory. Keep policy pure and native effects behind injected interfaces:

| Proposed module | Responsibility |
| --- | --- |
| photo-contract.ts | Zod key validation, inferred types, prepared and retained handles, availability and operation result unions. |
| photo-policy.ts | Target bytes, finite encoding attempts, aspect-ratio sizing, and deterministic candidate selection. |
| photo-store.ts | Preparation and retention lifecycle using injected encoder, file adapter, and key factory. No React or database imports. |
| photo-files.ts | Native filesystem operations and current document-root resolution. |
| photo-encoder.ts | Native image decoding, resizing, JPEG encoding, and releasing temporary outputs and native image references. |
| photo-access.ts and photo-access.web.ts | Native factory and an explicit unsupported browser implementation with the same public contract. |
| src/ui/photos/PhotoThumbnail.tsx | Shared presentation using an injected resolver and React Native Image. |

Expose preparePhoto(source, { signal }), retainPhoto(prepared), discardPreparedPhoto(prepared), and resolvePhoto(photoKey). Source describes a local image URI; decoded dimensions are authoritative. The optional AbortSignal permits cancellation before preparation returns a handle. Resolve returns a discriminated union: absent for a null key, available with a transient URI, or unavailable with a reason. Reasons distinguish missing, invalid-key, unreadable, and unsupported-platform outcomes.

Model each preparation as preparing, prepared, retaining, retained, discarded, or failed, with only the data valid for that state. Deduplicate repeated retain calls for the same handle. If the signal aborts during preparation, mark cancellation immediately, await the native operation, and delete only its generated output. After preparation resolves, discardPreparedPhoto owns cancellation. If retain has started, resolve its outcome before discard returns. Never allow discard to remove a promoted file.

Resolve errors retain diagnostic context. Do not turn permission or I/O errors into a false successful read. Cleanup failures are returned as structured issues alongside the primary outcome so they cannot hide a successful retention or replace the original failure.

### Bounded image processing

Use JPEG for the retained file and request no base64 output. Decode the source through Expo ImageManipulator, preserve aspect ratio, and do not upscale small images. Verify portrait orientation and receipt text on device. Its contextual API supports resize, renderAsync, and saveAsync; saveAsync writes a cache file, so its result must still be promoted to document storage. See the [ImageManipulator reference](https://docs.expo.dev/versions/latest/sdk/imagemanipulator/).

Define the initial target as 200,000 bytes. Use at most these three attempts, each from the original decoded source:

| Attempt | Maximum long edge | JPEG quality |
| --- | --- | --- |
| 1 | 1,600 pixels | 0.75 |
| 2 | 1,600 pixels | 0.60 |
| 3 | 1,280 pixels | 0.60 |

Stop at the first valid output at or below the target. If all valid outputs exceed it, retain the smallest output; break equal-size ties by earlier attempt. Do not fail a readable photo solely because it exceeds the approximate target. Stop on decoding or file errors and preserve the source for a retry. Reject empty output and invalid dimensions.

These values are starting policy, not measured results. Record bytes, dimensions, attempt count, and elapsed processing time for device samples. Adjust the policy only if device evidence shows poor readability, excessive size, or unacceptable delay. Avoid an unbounded quality search that delays capture. Quality fractions and image geometry are not monetary arithmetic; no amount enters this module.

Release unused encoder outputs after each attempt and release native image references when processing ends. Do not read encoded image bytes into JavaScript solely to measure their size. The caller owns the camera or library source; this adapter never deletes it.

### Durable retention sequence

1. Decode and encode to owned temporary output. Generate and validate the key. Copy the selected output into the owned staging path and verify nonzero size against the selected candidate.
2. Return a prepared handle only after staging succeeds. It is not yet valid to write its key into a transaction.
3. On retainPhoto, create the destination directory and move the staged file to its final path without overwrite. Verify the final file and expected size before returning a retained handle. The encoder cache URI is never the returned durable location.
4. If the move reports an error, inspect staging and destination. Return retained only when the operation's ownership and complete final output can be established. Otherwise return a failure with context and keep uncertain final files. Do not assume that an exception proves no file was written.
5. Remove owned temporary output. A cleanup failure after verified retention returns retention success plus a cleanup issue. The caller can continue without encoding another copy.
6. Only after retention returns success may CAPTURE-003 write photoKey into its draft. A database error must not trigger deletion of a retained photo.

Filesystem promotion and SQLite commit are separate operations. Prefer an unreferenced retained file after a crash to a committed draft whose photo was removed. Do not claim cross-resource atomicity or stronger filesystem guarantees than the adapter and device checks establish.

### Cancellation, failure, and restart matrix

| Boundary or failure | Required result and cleanup |
| --- | --- |
| Camera cancellation before preparation | No photo-store call and no ledger write. Camera ownership stays in CAPTURE-003. |
| Cancellation during encoding or staging | Await the outstanding operation, remove its owned output, return cancelled, and expose cleanup issues. Never return a retained handle. |
| Source cannot decode, storage is full, or staging copy fails | Return the failing phase and cause. Remove only owned partial output. No ledger write; source remains available if its owner retains it. |
| Cancellation after preparation but before retention | discardPreparedPhoto removes staging and owned encoder output. Repeated discard is safe. |
| Cancellation races with retention | Serialize terminal operations for this handle. If promotion completed, preserve the retained file and report that state. The caller may cancel the later draft write. |
| Final file cannot be verified | Report failure; do not permit a draft write. Preserve an uncertain final file rather than overwriting or deleting it on retry. |
| Database write definitely fails after retention | Keep the file and handle for retry. No photo re-encoding. CAPTURE-003 owns retrying the draft operation. |
| Database outcome is uncertain, or the process exits around commit | Preserve the retained file. On restart, SQLite decides whether a draft exists. CAPTURE-003 must resolve duplicate-draft retries at its write boundary. |
| Publication or a view refresh fails after commit | The draft and photo remain saved. Retry publication or reading, never photo retention or draft insertion. |
| Restart leaves staging files | Clean the staging directory before accepting new preparation work. No draft may reference staging. Coordinate initialization once so concurrent preparation cannot race cleanup. |
| Staging cleanup fails | Return a recoverable initialization error for capture, with retry. Other ledger screens remain usable. Never sweep unrelated cache directories. |
| Restart leaves unreferenced final files | Keep them. There is no automatic retained-file garbage collection in this task. |
| Complete, edit, or soft-delete a transaction | Keep its photoKey and retained file. The photo store subscribes to no deletion notifications. |
| Referenced file is missing, corrupt, or unreadable | Show Photo unavailable. Preserve the row, status, amount, category, and unknown count. |

Keeping a final file after an abandoned database write can consume extra storage. This is an intentional bounded-per-attempt cost of avoiding a destructive cleanup race. A future explicit retention-policy task can address unused final files if device use shows a need. Do not introduce a manifest or recurring ledger scan here.

## Thumbnail and backup behavior

PhotoThumbnail accepts photoKey and a resolver. Render a loading placeholder, the resolved image, No photo for a null key, or Photo unavailable for an unavailable result. Handle Image.onError because a file can disappear or fail decoding after resolution. Provide an accessible label for each state and use existing tokens.

Ignore late results after unmount or a key change. Clear stale availability when the key changes. Support an explicit reload request or revision from the owning screen so a file can be rechecked without changing its key. Do not compute, format, or default transaction amounts inside the thumbnail. Test the behavior, not pixel styling.

Use the same retained image for thumbnail and full-photo presentation. CAPTURE-004 and CAPTURE-005 will place this component in their screens; this task does not add an inbox route.

Keep photoKey as the only persisted photo field in a transaction. Do not serialize a retained handle, file URI, or image bytes into ledger data or shared UI state. DATA-011 will export the key even when the file is missing or the transaction is soft-deleted. DATA-014 will export the corresponding retained files separately. Document that handoff here; do not build a substitute JSON exporter merely to test an export feature that does not exist yet.

## Execution stages and commits

Commit each stage after its local checks pass. Target modules below 400 lines. Keep each complex stage below 500 changed lines and other nonmechanical stages below 800. Split an oversized stage before continuing; dependency lockfile churn can be reviewed separately as mechanical changes. Do not push without user consent. Native build evidence requires the existing GitHub Actions workflow after an authorized push or dispatch.

### Stage 1. Define contracts and processing policy

1. Run taskroot validate, taskroot list, and taskroot context app:CAPTURE-002 --format json. Confirm UI-020 remains Done and the task is ready, then run taskroot start app:CAPTURE-002.
2. Add photo-contract.ts and photo-policy.ts with the key grammar, state unions, encoding attempts, and deterministic selection rules above.
3. Add tests/photo-policy.logic.test.ts for key validation, portrait and landscape sizing, small inputs, invalid metadata, target equality, oversize fallback, and equal-size ties.
4. Run the focused logic tests, typecheck, task validation, and diff checks.

Commit: feat(capture): define photo storage contracts and encoding policy

### Stage 2. Add and isolate native adapters

1. Run npx expo install expo-file-system expo-image-manipulator expo-crypto. The installed SDK map currently specifies ~57.0.7, ~57.0.17, and ~57.0.3 respectively. Recheck the map at implementation time and commit package.json with the lockfile. Keep SDK 57.
2. FileSystem earns a direct dependency because the app imports it. ImageManipulator supplies native image encoding. Crypto supplies native UUID generation without coupling file identity to SQLite or assuming a browser global. Inject its key factory in tests. Expo documents randomUUID in its [Crypto reference](https://docs.expo.dev/versions/latest/sdk/crypto/#cryptorandomuuid).
3. Implement photo-files.ts and photo-encoder.ts with contextual errors, no overwrite, measured file size, and owned-output cleanup. Add the browser boundary with the native factory in Stage 3 so both platform exports arrive together.
4. Add adapter tests with a filesystem fake that can fail individual operations and an encoder fake that returns specified sizes. Cover native call mapping separately from lifecycle behavior.
5. Run adapter tests, typecheck, npx expo install --check, npm run doctor, npm ls, and web and iOS JavaScript exports. The iOS export proves bundling only; it does not prove native compilation.

Commit: feat(capture): add native photo file and encoding adapters

### Stage 3. Implement retention and failure recovery

1. Implement photo-store.ts and the native factory with serialized initialization and per-handle lifecycle transitions.
2. Implement prepare, retain, discard, and resolve. Carry the primary outcome and cleanup issues separately. Keep retained destinations outside every delete path.
3. Add tests/photo-store.logic.test.ts covering the failure matrix, concurrent terminal operations, key collisions, a move that succeeds before throwing, failed verification, repeated retention, and repeated discard.
4. Use injected barriers to test races deterministically. Recreate the store over the same fake storage to test restart cleanup and final-file retention. No timers, physical camera, or arbitrary sleeps are needed.
5. Run focused tests, typecheck, task validation, and diff checks.

Commit: feat(capture): retain photos and recover interrupted preparation

### Stage 4. Prove ledger and money boundaries

1. Add tests/photo-retention.database.test.ts using actual migrations, a disk-backed SQLite fixture, and a persistent temporary directory for photo files. Reuse the public transaction API to create drafts after successful retention.
2. Close and reopen both storage boundaries. Verify the same key resolves after restart, completion, and soft deletion. Read deleted rows with the existing includeDeleted option.
3. Inject a genuine rejected SQL write after retention. Assert no new transaction, no ledger notification, and a surviving photo available for retry. Keep capture-specific idempotent insertion in CAPTURE-003.
4. Test an unknown draft and a known draft of 12,345 VND. Remove only the fixture photo externally, then assert unchanged ledger values and unchanged computeBudget output for the same input and clock. The unknown remains null and contributes to the unknown count; the known amount remains exact.
5. Verify transaction serialization contains only its existing photoKey field as photo metadata. Record DATA-011 as the owner of the eventual actual backup-export assertion.
6. Run the focused database tests and existing transaction, money, and budget regression suites, plus typecheck.

Commit: test(capture): verify photo retention across ledger failure and restart

### Stage 5. Add the reusable unavailable thumbnail

1. Add PhotoThumbnail using the shared visual tokens and injected resolver. Keep native storage imports out of its component test boundary.
2. Add tests/photo-thumbnail.component.test.tsx for loading, absent, available, missing, invalid key, I/O failure, image decoding failure, reload, and stale asynchronous results.
3. Confirm a parent can render a draft's amount or unknown state unchanged beside an unavailable thumbnail. Do not add money calculations to the UI.
4. Run focused component tests, typecheck, and the web export.

Commit: feat(capture): render photo availability explicitly

### Stage 6. Verify on the iPhone and record evidence

1. Add docs/build/capture-photo-storage.md with the device procedure below and a result table. Keep unrun results explicitly pending.
2. Provide a small development-only probe under src/app/diagnostics/photos.tsx with a matching .web.tsx fallback. Release access returns to Home. Use the real adapters and bundled, nonpersonal image fixtures; keep fixture loading and controls separate from the store. Declare expo-asset directly if the probe imports it to materialize local fixture URIs. It is already supplied transitively by Expo, but direct imports must be declared.
3. The probe prepares, retains, resolves by stable key, and displays bytes, dimensions, attempts, and elapsed time. Persist only test keys in a probe-owned document file so restart checks do not depend on React state. It must not seed or mutate the user's ledger. Database integration tests already exercise the ledger boundary.
4. Add targeted probe tests only for release gating and error/retry behavior. Run the final local commands below and commit the probe and pending runbook as a buildable stage.
5. Once an authorized CI-built development IPA is available, execute the device procedure. Record its commit, build number, iOS version, sample results, and failures. Commit measured evidence separately; correct any failures in small verified commits.
6. Mark criteria checked only after their evidence exists. Run taskroot validate, then taskroot done app:CAPTURE-002 only when all criteria are satisfied. Validate and inspect taskroot show app:CAPTURE-002 afterward. Missing iPhone evidence leaves this task unfinished; it does not justify claiming device success.

Commits: test(capture): add the photo storage device probe; docs(capture): record durable photo verification

## Verification commands

Run each focused suite when its module changes. Before the final implementation commit, run:

```bash
npm test -- --runInBand
npm run typecheck
python3 -m unittest discover -s tests -p '*_test.py'
npm run web:export
npx expo export --platform ios
npx expo install --check
npm run doctor
git diff --check
taskroot validate
taskroot list
```

Fix relevant failures before committing. Record a pre-existing or environment failure explicitly instead of treating a partial check as a pass. Do not run expo run:ios locally; macOS CI is the native build environment.

## iPhone procedure and acceptance evidence

Use at least six nonpersonal samples: a portrait receipt with small text, a landscape purchase photo, a dark noisy image, a detailed scene, an already-small image, and a source with rotated orientation metadata. Include JPEG and a supported HEIC source. Load bundled fixtures into local files through the probe so camera acquisition does not become a dependency on CAPTURE-003.

1. Run each sample through the real encoder and retention path offline. Record original and output dimensions, actual bytes, attempt count, and elapsed time. Confirm readable text, correct orientation, and no upscaling.
2. Report median and largest output size and processing time. Treat a representative median above 300,000 bytes or processing alone above one second as a reason to tune and rerun; record any readability tradeoff. These are review thresholds for the initial policy, not a hard rejection of an individual photo. CAPTURE-003 measures the full two-second capture flow.
3. Retain files, force-quit, reopen, and resolve the saved test keys. Verify final bytes and dimensions match. Repeat after restarting the phone and after an app update that preserves its container when such a candidate is available.
4. Remove generated cache copies through the probe's owned-file controls and confirm retained files still open. Cancel before retention and confirm staging cleanup. Force-quit with staged output, reopen, and confirm initialization removes only staging.
5. Use a probe-only fault operation on a dedicated fixture file to simulate a missing retained photo. Confirm Photo unavailable. Restore that fixture under the same key and explicitly reload to verify recovery. This test operation must not be part of the production store API.
6. Record local database evidence for soft deletion and known/unknown preservation alongside the device observations. Check real camera permissions and full saved-draft behavior later under CAPTURE-003; do not label fixture loading as a camera test.

| Acceptance criterion | Required evidence |
| --- | --- |
| Durable platform adapter, stable keys, roughly 200KB output | Policy and adapter tests, non-overwrite tests, CI native build, device size and readability measurements. |
| Cancellation and failure cleanup; restart and soft-deletion retention | Lifecycle failure matrix tests, disk-backed SQLite restart and soft-deletion tests, iPhone force-quit and staging recovery results. |
| Photos outside routine JSON; explicit unavailable thumbnail with unchanged amount | Key-only ledger representation, documented DATA-011 export handoff, thumbnail failure tests, money regression tests. Actual JSON exporter coverage remains DATA-011's responsibility. |
| Deterministic recovery fixtures and recorded iPhone results | Controlled fake failures, race barriers, real temporary-file integration, and the completed device runbook with build identity. |

## Implementation limits to retain

Retained orphans are preserved intentionally. Older or unsupported keys remain readable as transaction metadata and render an unavailable photo. Image quality and latency require device measurements. Native compilation and device retention cannot be proved by mocked adapters or a JavaScript export. None of these limits changes a transaction amount or permits an unknown to become zero.
