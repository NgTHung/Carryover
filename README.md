# Carryover

Carryover is a personal budgeting app for income that arrives on no schedule. The balance carries across months instead of resetting, fixed commitments are reserved off the top, and what remains is divided by days to a horizon you can move. Purchases are captured as a photo in about two seconds and finished later, and an unfinished capture is shown as an explicit unknown rather than counted as zero.

The app targets iOS, is built with Expo and React Native, and is distributed as an unsigned IPA that you sign on device. There is no Mac in this toolchain.

## Status

Stage 1 schema work is under review. DATA-001 is reopened to fix default soft-delete reads and SQL money bounds. Zod validation and Zustand UI state are specified for upcoming implementation in [State and validation](docs/state-and-validation.md).

The agreed navigation, UI, and test stack is recorded in [App stack and testing](docs/app-stack-and-testing.md). Setup tasks track Expo Router, NativeWind with Tailwind Variants, Reanimated, and Jest with React Native Testing Library. Hermes remains the default engine; Maestro will run on demand in macOS CI.

A sideloaded IPA can drive a home screen widget on a free Apple account. **Sideload with iloader.** AltStore and SideStore do not register the App Group, so the widget cannot work under them. The app also resolves its App Group at runtime, because every sideloader rewrites the identifier and nothing rewrites the Info.plist key that expo-widgets reads. See [the result document](docs/build/widget-sideload-result.md).

## Getting started

You need Node 22.13 or newer. This machine uses `nub`, which bundles its own Node and provides npm shims.

```bash
npm install
npm test
npm run typecheck
npm run web
```

`npm run web` opens a local UI preview with Fast Refresh. The current stage 0 screen shows that native diagnostics are unavailable. It does not open the ledger or the iOS widget. See the [unsigned IPA pipeline](docs/build/ios-unsigned-ipa.md#local-ui-development) for the browser boundary and the iPhone development-build loop.

You cannot build for iOS locally. Push, and the `iOS unsigned IPA` workflow builds a Release IPA on a macOS runner. For device Fast Refresh, dispatch the workflow with `development` enabled, install the resulting Carryover Dev IPA beside Carryover, and run `npm run start:device`. Keep the two bundle identifiers distinct when signing so your test data stays separate from your release ledger. The widget extension is excluded until stage 6; dispatch a Release build with the `widget` input to build one.

Jest logic, real SQLite, and component tests run locally on Linux. BUILD-003 adds a separate iOS Simulator build for Maestro on demand and before releases, without adding it to every push.

## Layout

```
App.tsx                     native entry point and ledger migration gate
App.web.tsx                 browser UI preview entry point
src/dev/                    stage 0 screen and platform diagnostics
widgets/                    the home screen widget component
src/budget/snapshot.ts      the snapshot contract every surface reads
docs/state-and-validation.md data ownership and validation boundaries
docs/DESIGN.md              the product design language
docs/spec/                  the settled product contract
docs/build/                 pipeline and sideload documentation
.tasks/                     task files, validated by taskroot
.github/workflows/ios.yml   the only iOS build environment
```

## Working on this

Read `AGENTS.md` before changing code, `CONTEXT.md` before naming anything, and `docs/state-and-validation.md` before adding data or state modules. Read `docs/DESIGN.md` before changing a screen. The money invariants in `AGENTS.md` are not style preferences, and breaking one corrupts data quietly.

Task work goes through `taskroot`:

```bash
taskroot validate
taskroot ready
```
