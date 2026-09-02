# Unsigned IPA pipeline

Carryover is built for iOS without a Mac. Every iOS binary must be compiled by Xcode on macOS, so the build runs on a GitHub Actions macOS runner and nowhere else. The runner produces an unsigned IPA, and you sign it on device when you sideload. That split removes the whole certificate half of iOS CI: no signing identity, no provisioning profile, no App Store Connect key, no secrets in the repository.

## How a build reaches your phone

Push to any branch. The `iOS unsigned IPA` workflow runs `expo prebuild` to generate the native project, installs pods, builds with signing disabled, wraps the `.app` in a `Payload/` directory, and uploads the result as a workflow artifact. Download the artifact, unzip it, and sideload the IPA with AltStore, SideStore, or Sideloadly.

The build excludes the widget extension. WIDGET-001 settled that a sideloaded IPA can carry a working widget, so the two-variant control build has done its job and stage 6 owns the rest. To build one, dispatch the workflow manually and set the `widget` input, which passes `CARRYOVER_WIDGET=1` through to `app.config.js`.

Commits that touch only Markdown, `docs/`, or `.tasks/` do not build. Pushing twice cancels the first run.

## Cost

macOS runner minutes bill at ten times the Linux rate, so a private repository on the free tier gets roughly 200 macOS minutes per month. A build takes about four minutes, so budget that per code push. Make the repository public for unlimited free minutes, or push deliberately rather than continuously.

Most of that four minutes is `xcodebuild` compiling the React Native pods from scratch. `expo prebuild --clean` regenerates `ios/`, so nothing from the previous run is reusable and there is no derived-data cache to hit.

The typecheck job runs on Linux and is effectively free. Let it catch what it can before a macOS runner starts.

## What free signing cannot do

A free Apple ID signs an app for seven days, after which it stops launching until you refresh it.

App Groups do work on a free account, so the widget does not need the paid membership. It needs the right sideloader. **Use iloader.** AltStore and SideStore do not register the App Group, and the widget cannot work under them. See the [widget sideload result](widget-sideload-result.md) for the evidence and for the runtime resolution the app needs on top.

Local notifications work on a free build. Remote push does not.

A paid membership costs 99 USD per year and buys TestFlight, so another person can install without a computer or a weekly refresh, plus remote push. Neither is needed for v1.

## Dependency pinning

Both jobs run `npm ci` against the committed `package-lock.json`, so a build installs exactly what was resolved here.

`package.json` pins `react-dom` to react's version through an `overrides` entry. `@expo/ui` ships web components whose transitive `react-dom` peer resolves ahead of the react version Expo pins, and stock npm refuses the mismatch even though every consumer accepts `^19.0.0`. Holding `react-dom` at react's version fixes it without moving react off the SDK pin. Remove the override only after checking that `npm ci` still succeeds on a clean runner, because a local install can silently override a peer that CI rejects.
