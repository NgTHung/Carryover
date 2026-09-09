# Carryover

Carryover is a personal budgeting app for irregular income. It answers one question clearly: how much can you spend today?

Your carryover balance continues across periods instead of resetting each month. Reserves protect money already committed to rent, bills, and other fixed costs. The app divides your discretionary money by the days to a horizon you choose, then reports one honest per day figure.

Carryover is designed for the moments when detailed budgeting breaks down. You can capture a purchase as a photo in about two seconds and complete the draft later. A draft without an amount stays unknown, so the app never hides uncertainty by counting it as zero.

## What the app does

- Carries your real balance forward across periods.
- Sets reserves aside before calculating discretionary money.
- Shows a per day figure based on when your money must last until.
- Captures purchases as photo drafts with no required fields at capture time.
- Tracks bank and cash accounts, transfers, and visible reconcile adjustments.
- Charges only your own share of a split to your budget.
- Tracks receivables and settlements without treating repayments as income.
- Keeps transfers, adjustments, and settlements out of spending reports.

The home screen and iOS widget will read the same precomputed snapshot. They cannot disagree about your budget because all budget arithmetic lives in one pure function.

## Product principles

Money correctness comes first. Amounts are positive integer VND, direction carries the sign, and split remainders go to the payer deterministically. Historical period figures use their stored month config, so changing today's settings cannot rewrite the past.

Capture speed comes next. Taking a photo must stay quick even when you do not know the amount, category, or account yet. Carryover reports uncertainty instead of blocking the capture or inventing a value.

The interface reports what happened without scolding you. Quality is your own optional judgment: need, want, or regret.

## Project status

Carryover is a work in progress. The ledger schema, accounts, categories, transaction data layer, navigation shell, and shared UI foundation are in place. The next stages add the transaction and category screens, the budget engine, photo capture, splits, backup and restore, and the home screen widget.

Development work and release gates live in [`.tasks/`](.tasks/) and are validated with `taskroot`. The product contract lives in [the v1 specification](docs/spec/carryover-v1.md), and [the design constitution](docs/DESIGN.md) defines how the app should feel.

## Run the current build

You need Node 22.13 or newer. This machine uses `nub`, which bundles its own Node and provides npm shims.

```bash
npm install
npm test
npm run typecheck
npm run web
```

`npm run web` opens the local UI preview with Fast Refresh. The browser build supports interface work, but native ledger and widget features remain unavailable there. Jest logic, real SQLite, and component tests run locally on Linux.

## Build for iPhone

Carryover targets iOS with Expo and React Native. The project has no local Mac or simulator, so GitHub Actions is the iOS build environment.

Push a revision to run the `iOS unsigned IPA` workflow. The workflow produces an unsigned Release IPA on a macOS runner. Sign and install it on your device with iloader. AltStore and SideStore do not register the App Group required by the widget.

For device Fast Refresh, dispatch the workflow with `development` enabled, install the Carryover Dev IPA beside the release app, and run:

```bash
npm run start:device
```

Keep the development and release bundle identifiers distinct when signing so test data stays separate from your real ledger. The widget target is excluded by default while the app is under development. See [the unsigned IPA guide](docs/build/ios-unsigned-ipa.md) and [the widget sideload result](docs/build/widget-sideload-result.md) for build and signing details.

## Project map

```text
src/app/                     thin Expo Router route files
src/screens/                 route screens and layouts
src/ui/                      shared controls, tokens, and motion
src/data/                    ledger schema and data access
src/budget/snapshot.ts       snapshot contract shared by every surface
widgets/                     iOS home screen widget
tests/                       logic, database, and component tests
docs/spec/                   product contract
docs/build/                  build and sideload documentation
.tasks/                      versioned development work
.github/workflows/ios.yml    iOS build workflow
```

Read [`AGENTS.md`](AGENTS.md) before changing code and [`CONTEXT.md`](CONTEXT.md) before naming anything. Read [state and validation](docs/state-and-validation.md) before adding data or state modules.

```bash
taskroot validate
taskroot ready
```
