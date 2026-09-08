# Unsigned IPA pipeline

Carryover is built for iOS without a Mac. Every iOS binary must be compiled by Xcode on macOS, so the build runs on a GitHub Actions macOS runner and nowhere else. The runner produces an unsigned IPA, and you sign it on device when you sideload. That split removes the whole certificate half of iOS CI: no signing identity, no provisioning profile, no App Store Connect key, no secrets in the repository.

## How a build reaches your phone

Push to any branch. The `iOS unsigned IPA` workflow runs `expo prebuild` to generate the native project, installs pods, builds with signing disabled, wraps the `.app` in a `Payload/` directory, and uploads the result as a workflow artifact. Download the artifact, unzip it, and sideload the IPA with AltStore, SideStore, or Sideloadly.

The build excludes the widget extension. WIDGET-001 settled that a sideloaded IPA can carry a working widget, so the two-variant control build has done its job and stage 6 owns the rest. To build one, dispatch the workflow manually and set the `widget` input, which passes `CARRYOVER_WIDGET=1` through to `app.config.js`.

Commits that touch only Markdown, `docs/`, or `.tasks/` do not build. Pushing twice cancels the first run.

## Local UI development

Use the browser for routine layout and style work:

```bash
npm run web
```

Expo opens the preview at `http://localhost:8081` and applies TypeScript, component, and style changes through Fast Refresh. Run `npm run web:export` when you need to verify the production browser bundle.

The browser displays an explicit preview notice. It does not open the ledger or load the iOS widget. Expo SQLite web support is alpha, and the SDK 57 synchronous API cannot open reliably during module evaluation. A browser database would create a second persistence environment without proving native SQLite behavior. Keep browser data typed and explicit. Use database tests and the iPhone development build for storage behavior.

Use the iPhone development build when you need iOS rendering or native behavior:

1. Open the `iOS unsigned IPA` workflow in GitHub Actions and select **Run workflow**.
2. Set `development` to true. The widget stays disabled for this build.
3. Download `carryover-development-ipa`, sign `carryover.ipa` with your existing on-device signer, and install it.
4. Start Metro on this machine:

   ```bash
   npm run start:device
   ```

5. Keep the phone and this machine on the same network. Open Carryover and select the displayed development server. You can also scan Metro's QR code.

If local discovery fails, use a tunnel:

```bash
npm run start:device -- --tunnel
```

Fast Refresh is enabled by default. TypeScript, JavaScript, styles, and bundled image changes do not need another IPA. Build and install a new development IPA after changing a native dependency, `app.config.js`, the Expo SDK, or native patch scripts.

The development IPA is a Debug build and needs Metro to serve the application. It is not a release artifact. Normal pushes and manual runs with `development` disabled continue to produce the Release `carryover-ipa` artifact.

## Cost

macOS runner minutes bill at ten times the Linux rate, so a private repository on the free tier gets roughly 200 macOS minutes per month. A build takes about four minutes, so budget that per code push. Make the repository public for unlimited free minutes, or push deliberately rather than continuously.

Most of that four minutes is `xcodebuild` compiling the React Native pods from scratch. `expo prebuild --clean` regenerates `ios/`, so nothing from the previous run is reusable and there is no derived-data cache to hit.

The typecheck job runs on Linux and is effectively free. Let it catch what it can before a macOS runner starts.

## Testing workflow

Run `npm test` and `npm run typecheck` locally before pushing. The existing SQLite tests already run on Linux. BUILD-002 migrated them to Jest and added React Native Testing Library; Linux CI runs the same fast checks before the macOS build.

BUILD-003 adds an on-demand Maestro workflow with its own Simulator .app and the widget disabled. The device IPA cannot run in a Simulator. Run Maestro against the candidate revision before releases; do not add its Simulator build to every code push. Native device build checks keep their existing triggers. See [App stack and testing](../app-stack-and-testing.md) for test ownership and device checks.

## What free signing cannot do

A free Apple ID signs an app for seven days, after which it stops launching until you refresh it.

App Groups do work on a free account, so the widget does not need the paid membership. It needs the right sideloader. **Use iloader.** AltStore and SideStore do not register the App Group, and the widget cannot work under them. See the [widget sideload result](widget-sideload-result.md) for the evidence and for the runtime resolution the app needs on top.

Local notifications work on a free build. Remote push does not.

A paid membership costs 99 USD per year and buys TestFlight, so another person can install without a computer or a weekly refresh, plus remote push. Neither is needed for v1.

## Dependency pinning

Both jobs run `npm ci` against the committed `package-lock.json`, so a build installs exactly what was resolved here.

`package.json` pins `react-dom` to react's version through an `overrides` entry. `@expo/ui` ships web components whose transitive `react-dom` peer resolves ahead of the react version Expo pins, and stock npm refuses the mismatch even though every consumer accepts `^19.0.0`. Holding `react-dom` at react's version fixes it without moving react off the SDK pin. Remove the override only after checking that `npm ci` still succeeds on a clean runner, because a local install can silently override a peer that CI rejects.
