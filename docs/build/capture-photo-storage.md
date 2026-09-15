# Capture photo storage verification

This runbook verifies the native capture-photo storage path from a signed
development IPA. It uses bundled, nonpersonal fixtures, not camera acquisition.
The probe route is `/diagnostics/photos`, and it is available only when
`CARRYOVER_VARIANT=development`. The browser route returns to Home.

The probe writes only `capture-photo-probe.json` in the app document directory.
That file contains fixture IDs and photo keys. It never opens SQLite or writes
transactions. The retained image files live under `photos/v1/`, outside ledger
JSON. The probe's remove and restore controls use a probe-owned temporary copy
to restore the exact retained JPEG under the same key.

## Before the run

1. Run the `iOS unsigned IPA` GitHub Actions workflow with `development` set to
   true. Native compilation requires the macOS runner.
2. Install `carryover-development-ipa` as Carryover Dev with the existing
   sideload procedure. Keep Carryover Dev separate from the release app.
3. Start Metro with `npm run start:device`, or use the Tailscale procedure in
   [Unsigned IPA pipeline](ios-unsigned-ipa.md).
4. Record the build identity below before opening the probe.
5. Open `/diagnostics/photos` in Carryover Dev. If direct navigation is needed,
   use `carryover-dev:///diagnostics/photos`.

Use a physical iPhone. The local TypeScript checks and JavaScript exports prove
bundling only. They do not prove native decoding, orientation, file retention,
or force-quit recovery.

## Fixture run

For every fixture, select it and press **Prepare photo**. Record the metrics
shown after preparation. Press **Retain photo**, then **Resolve saved key**.
Confirm the thumbnail opens and the saved key is the same after each later
step. Do not enter or create ledger data during this run.

The initial policy targets 200,000 bytes. An output above that target is still
valid when the bounded attempts choose the smallest available output. A median
above 300,000 bytes or processing alone above one second is a reason to tune
the policy and rerun. Check receipt text and orientation before changing it.

| Fixture | Original dimensions | Output dimensions | Bytes | Attempts | Processing ms | Readability and orientation | Result |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| Portrait receipt | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Landscape purchase | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Dark and noisy | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Detailed scene | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Already small | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Rotated JPEG, EXIF orientation 6 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| HEIC source | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Median / largest | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

For the already-small fixture, confirm the output dimensions do not exceed the
source dimensions. For the rotated JPEG, confirm the displayed image has the
expected orientation. For the HEIC source, confirm native decoding succeeds
and the retained file is the JPEG produced by the store.

## Restart and cleanup checks

Run these checks after at least one fixture has a saved key:

1. Force-quit Carryover Dev and reopen it. Reopen the probe, select the saved
   fixture, and press **Resolve saved key**. The same key must resolve and the
   thumbnail must open.
2. Restart the iPhone, reopen Carryover Dev, and repeat the resolve check when
   a restart window is available. Record whether the document container and
   retained file survived.
3. Prepare a fixture and press **Cancel** before retention completes. Wait for
   the cancellation result. Confirm no saved key appears and the next prepare
   can start. The store must await native work before reporting cleanup.
4. Start preparation, force-quit while it is running, and reopen the probe.
   Start another preparation. Initialization must clear only
   `capture-staging`; it must not remove an existing retained fixture.
5. Prepare a fixture and press **Discard** before retention. Confirm the
   operation reports that no retained photo was created. This exercises the
   owned encoder-output cleanup path.
6. Use **Fault: remove file**, then **Resolve saved key**. The result must say
   `missing`, and the thumbnail must say **Photo unavailable**. The saved key
   remains unchanged.
7. Press **Restore file**, then use **Resolve saved key** again. The same key
   must become available and the thumbnail must open. The restored bytes must
   be the exact retained JPEG, not the original PNG or HEIC source.

Do not use the fault controls on a user photo. They are limited to the
probe-owned retained path and its temporary backup.

## Evidence record

Keep unrun fields as `PENDING`. Replace them only with observed values and
include failure details when a check does not pass.

| Field | Result |
| --- | --- |
| Probe commit | PENDING |
| CI workflow URL | PENDING |
| Development IPA build number | PENDING |
| IPA installed and signed | PENDING |
| iPhone model | PENDING |
| iOS version | PENDING |
| Metro connection | PENDING |
| Force-quit and relaunch | PENDING |
| Phone restart | PENDING |
| App update retaining its container | PENDING |
| Cancellation before retention | PENDING |
| Staging recovery after force-quit | PENDING |
| Missing-file unavailable state | PENDING |
| Same-key restore | PENDING |
| Failures and follow-up commits | PENDING |

The local ledger evidence comes from
[`photo-retention.database.test.ts`](../../tests/photo-retention.database.test.ts):
the retained key survives close and reopen, completion, and soft deletion; a
rejected ledger write leaves the retained file; and removing a fixture file
does not change a known amount, an unknown amount, or the unknown count. Keep
that evidence alongside the device results. Camera permissions and full saved
draft behavior belong to CAPTURE-003.
