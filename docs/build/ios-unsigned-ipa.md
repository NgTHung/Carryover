# Unsigned IPA pipeline

Carryover is built for iOS without a Mac. Every iOS binary must be compiled by Xcode on macOS, so the build runs on a GitHub Actions macOS runner and nowhere else. The runner produces an unsigned IPA, and you sign it on device when you sideload. That split removes the whole certificate half of iOS CI: no signing identity, no provisioning profile, no App Store Connect key, no secrets in the repository.

## How a build reaches your phone

Push to any branch. The `iOS unsigned IPA` workflow runs `expo prebuild` to generate the native project, installs pods, builds with signing disabled, wraps the `.app` in a `Payload/` directory, and uploads the result as a workflow artifact. Download the artifact, unzip it, and sideload the IPA with AltStore, SideStore, or Sideloadly.

The workflow builds two variants in parallel. The `widget` variant includes the widget extension. The `plain` variant sets `CARRYOVER_WIDGET=0` and drops the plugin entirely. The plain build is a control: if it installs and the widget build does not, the widget extension caused the failure rather than the pipeline.

## Cost

macOS runner minutes bill at ten times the Linux rate, so a private repository on the free tier gets roughly 200 macOS minutes per month. A build takes about eight minutes and the matrix runs two, so budget around sixteen minutes per push. Make the repository public for unlimited free minutes, or push deliberately rather than continuously.

The typecheck job runs on Linux and is effectively free. Let it catch what it can before a macOS runner starts.

## What free signing cannot do

A free Apple ID signs an app for seven days, after which it stops launching until you refresh it. It also cannot provision several capabilities that Apple gates behind the paid Developer Program. App Groups is one of them, and the widget needs an App Group to receive data from the app.

Local notifications work on a free build. Remote push does not.

A paid membership costs 99 USD per year and solves three problems at once: App Groups for the widget, push notifications, and TestFlight so another person can install the app without a computer. Buy it when the widget or another person becomes real, not before.

## Dependency pinning

Both jobs run `npm ci` against the committed `package-lock.json`, so a build installs exactly what was resolved here.

`package.json` pins `react-dom` to react's version through an `overrides` entry. `@expo/ui` ships web components whose transitive `react-dom` peer resolves ahead of the react version Expo pins, and stock npm refuses the mismatch even though every consumer accepts `^19.0.0`. Holding `react-dom` at react's version fixes it without moving react off the SDK pin. Remove the override only after checking that `npm ci` still succeeds on a clean runner, because a local install can silently override a peer that CI rejects.
