# App stack and testing

Decision recorded on 2026-09-07. Use this contract when adding navigation, UI infrastructure, and tests. The tasks below own implementation; documenting a choice does not mean the package is installed.

## Stack

| Area | Decision | Reason |
| --- | --- | --- |
| Navigation | Expo Router | Typed routes and direct links give screens one navigation owner. |
| Shared UI state | Zustand | Selected period and filters can survive navigation without copying the ledger. |
| Validation | Zod | Shared runtime schemas validate input at the data boundary. |
| Storage | Expo SQLite with Drizzle | Real SQLite constraints protect persisted money. |
| Styling | Stable NativeWind and compatible Tailwind CSS and Tailwind Variants | Shared tokens and typed variants keep repeated controls consistent. |
| Animation | Reanimated directly | It covers the required motion without an additional Moti compatibility dependency. |
| JavaScript engine | Hermes bundled with Expo and React Native | Keep the engine aligned with the native framework and its tooling. |
| Fast tests | Jest and React Native Testing Library | Logic, storage, and component behavior can be checked on Linux. |
| End-to-end tests | Maestro on an iOS Simulator in macOS CI | Exercise the native app on demand and before releases. |

TanStack Query and Moti are deferred. Use stable NativeWind rather than its preview release. NativeWind's stable line currently targets Tailwind 3, so select compatible Tailwind Variants and class-merging versions together. Record the resolved versions when implementing UI-007 and commit the lockfile. Install Expo native packages at the versions supported by the project's SDK. Do not upgrade the SDK to satisfy a styling package without a separate decision.

UI-007 pins the compatible styling set to NativeWind 4.2.6, Tailwind CSS 3.4.19,
Tailwind Variants 0.3.1, and its Tailwind Merge 2.5.4 dependency. Tailwind
Variants 0.3.1 stays on the Tailwind 3 line; Tailwind Merge 3 drops Tailwind 3
support. Reanimated 4.5.1 and Worklets 0.10.1 are direct dependencies because
they are the versions bundled for Expo SDK 57. The lockfile must resolve one copy
of each package, and `npm ls` must report no invalid peer dependencies. The
compatibility references are [NativeWind's Expo installation guide](https://www.nativewind.dev/docs/getting-started/installation),
[Tailwind Merge's v2 support matrix](https://github.com/dcastil/tailwind-merge/tree/v2.6.0),
and [Tailwind Variants' Tailwind 4 release boundary](https://github.com/heroui-inc/tailwind-variants/releases/tag/v1.0.0).

## Navigation and UI

Put thin route files under src/app. Keep screen implementations, shared components, database setup, and domain logic outside that directory. The native root layout gates database-backed screens on migration success and exposes startup failures. The browser root layout intentionally omits the SQLite boundary so the preview cannot query the ledger.

Expo Router owns route history and route parameters. Route to a transaction by id, then validate the parameter and load the row through the public data API. Invalid ids stop before the read, and missing rows have an explicit unavailable state. Zustand holds shared UI state that is not already represented by the route. Do not mirror route history or an active route's transaction id into a store. Screen-local input stays in React state.

Use tokens from [the design constitution](DESIGN.md) for color, spacing, and typography. Tailwind Variants defines reusable control variants. Reanimated owns dynamic animation styles and shared motion helpers. Respect the native reduced-motion preference and the design's cross-fade fallback.

Animate presentation without changing the snapshot. Animation progress may be fractional; an amount may not. No component, store selector, or animation worklet computes a budget figure. The widget keeps its own rendering implementation and consumes the shared snapshot without loading app navigation, styling, or state libraries.

See [State and validation](state-and-validation.md) for ledger ownership, Zod schemas, and snapshot publication.

## Local checks

Jest runs pure logic, real SQLite, and React Native component projects. The database project keeps six regression cases against real in-memory SQLite. Fast checks require Node 22.13 or newer, and they do not require Xcode or a native build.

```bash
npm test
npm run test:logic
npm run test:database
npm run test:component
npm run test:watch
npm run typecheck
```

Use a Node test environment for pure money functions, validation, stores, and database integration. Use the jest-expo preset with @testing-library/react-native for component interactions, route behavior, and loading or error states. Keep all tests in tests/, outside src/app.

Database integration tests apply the actual migrations to real SQLite. Component tests mock native edges only at the component boundary, and those mocks cannot prove SQL constraints or migration behavior. Use Jest project selection and test-name matching for focused checks:

```bash
npm test -- --selectProjects database -t "fractional writes"
npm run test:watch
```

## CI and release checks

| Check | Where | When |
| --- | --- | --- |
| Typechecking, logic, database, and component tests | Local Linux and Linux CI | During development and on code pushes |
| Unsigned iOS device build | GitHub Actions macOS runner | Existing code-push and manual triggers, after fast checks pass |
| Maestro smoke suite | iOS Simulator on a GitHub Actions macOS runner | On demand and before releases |
| Camera, keyboard, photo access, and sideload behavior | Your iPhone | Before releasing affected features |
| Widget rendering and shared-storage behavior | Your iPhone | When WIDGET-002 resumes |

The widget extension is already excluded from normal builds. Keep it excluded from the default Simulator test build too. Exclusion does not make an iOS Simulator available on Linux.

BUILD-003 creates a separate Simulator .app. The unsigned device IPA targets a different platform and cannot be reused for Simulator tests. Keep Maestro off the normal push path so it does not add another native build to each iteration. Run a passing smoke suite against the candidate revision before release and retain logs and screenshots when it fails.

Start with startup, navigation, transaction editing, unknown-draft persistence across restart, and the home snapshot. Extend the suite as capture and restore arrive. Use deterministic fixtures and isolate test runs. Real camera behavior and sideloaded widget behavior still need device checks.

Do not add an Android build solely for local end-to-end testing. The local suites cover the fast development loop; native build checks remain required on code commits. See [the pipeline guide](build/ios-unsigned-ipa.md) for the existing build path.

## Implementation ownership

| Task | Outcome |
| --- | --- |
| BUILD-002 | Local Jest setup, React Native Testing Library, and fast Linux CI checks |
| BUILD-004 | Browser UI preview and an unsigned iPhone development build with Fast Refresh |
| UI-006 | Expo Router shell, startup gating, and route tests |
| UI-007 | Shared NativeWind tokens, typed variants, and Reanimated helpers |
| UI-001 and UI-002 | First product screens reuse the navigation and UI foundations |
| UI-003 | Home subscribes to the published snapshot and uses shared presentation helpers |
| BUILD-003 | On-demand iOS Maestro workflow and release checklist |
| CAPTURE-001 and DATA-008 | Add capture and restore flows when those features exist |
| WIDGET-002 | Resume widget-specific implementation and device verification |

References: [Expo navigation](https://docs.expo.dev/develop/app-navigation/), [Expo testing](https://docs.expo.dev/develop/unit-testing/), [Maestro iOS](https://docs.maestro.dev/getting-started/build-and-install-your-app/ios), [NativeWind installation](https://www.nativewind.dev/docs/getting-started/installation), [Tailwind Variants](https://www.tailwind-variants.org/docs/introduction), [Reanimated](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/), and [Hermes](https://docs.expo.dev/guides/using-hermes/).
