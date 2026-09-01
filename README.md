# Carryover

Carryover is a personal budgeting app for income that arrives on no schedule. The balance carries across months instead of resetting, fixed commitments are reserved off the top, and what remains is divided by days to a horizon you can move. Purchases are captured as a photo in about two seconds and finished later, and an unfinished capture is shown as an explicit unknown rather than counted as zero.

The app targets iOS, is built with Expo and React Native, and is distributed as an unsigned IPA that you sign on device. There is no Mac in this toolchain.

## Status

Stage 0. The pipeline and the widget install spike. No product code yet.

The immediate open question is whether a sideloaded IPA can carry a working home screen widget on a free Apple account. Nothing downstream should assume an answer. See [the result document](docs/build/widget-sideload-result.md).

## Getting started

You need Node. This machine uses `nub`, which bundles its own Node and provides npm shims.

```bash
npm install
npm run typecheck
```

You cannot build for iOS locally. Push, and the `iOS unsigned IPA` workflow builds both variants on a macOS runner and uploads them as artifacts.

## Layout

```
App.tsx                     stage 0 spike screen
widgets/                    the home screen widget component
src/budget/snapshot.ts      the snapshot contract every surface reads
docs/spec/                  the settled product contract
docs/build/                 pipeline and sideload documentation
.tasks/                     task files, validated by taskroot
.github/workflows/ios.yml   the only iOS build environment
```

## Working on this

Read `AGENTS.md` before changing code and `CONTEXT.md` before naming anything. The money invariants in `AGENTS.md` are not style preferences, and breaking one corrupts data quietly.

Task work goes through `taskroot`:

```bash
taskroot validate
taskroot ready
```
