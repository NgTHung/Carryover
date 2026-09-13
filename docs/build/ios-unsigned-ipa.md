# Unsigned IPA pipeline

Carryover is built for iOS without a Mac. Every iOS binary must be compiled by Xcode on macOS, so the build runs on a GitHub Actions macOS runner and nowhere else. The runner produces an unsigned IPA, and you sign it on device when you sideload. That split removes the whole certificate half of iOS CI: no signing identity, no provisioning profile, no App Store Connect key, no secrets in the repository.

## How a build reaches your phone

Push to any branch. The `iOS unsigned IPA` workflow runs `expo prebuild` to generate the native project, installs pods, builds with signing disabled, wraps the `.app` in a `Payload/` directory, and uploads the result as a workflow artifact. Successful default-branch builds also publish a signer source and direct IPA downloads through GitHub Releases. You can still download the artifact, unzip it, and sideload the IPA yourself.

## Install and update through your signer

Add the source URL for the app you want in your signer's repository or source screen. Choose the AltStore format. FlareStore documents compatibility with this format in FlareStore, ESign, and other supporting signers in its [repository guide](https://flarestore.app/repo-creator/).

| App | Source URL |
| --- | --- |
| Carryover | `https://github.com/NgTHung/Carryover/releases/download/ios-release/source.json` |
| Carryover Dev | `https://github.com/NgTHung/Carryover/releases/download/ios-development/source.json` |

These URLs become available after the first successful build and publication for each channel. No GitHub Pages setup, signing certificate, or extra secret is required. Downloads require the repository to remain public. Each source lists only its channel's current build.

1. Run the workflow on `main` with `development` enabled to publish Carryover Dev. Leave `widget` disabled. Normal code pushes to `main` publish Carryover.
2. Refresh the source in your signer, select the app, then download, sign, and install it with your existing certificate and profile.
3. For subsequent native builds, refresh the same source and install over the existing app. Keep the same signing identity, bundle identifier, and App Group mapping. Deleting the installed app deletes its local data.
4. For TypeScript and JavaScript edits in Carryover Dev, run `npm run start:device` and use Fast Refresh. You only need a new IPA when native dependencies or app configuration change.

The source format handles discovery and downloads. Your signer still handles signing and installation. The app requires a working App Group even without the widget; importing an AltStore-format source does not prove your signer can provision that entitlement. The project's verified signing path is recorded in the [widget sideload result](widget-sideload-result.md).

CI sets the native build number to the workflow run number and attempt, such as `42.2`. The generator reads the version, build number, minimum iOS version, privacy descriptions, and byte size from the actual IPA. It reads entitlements from the generated native project. It includes modern version metadata and legacy signer fields. [AltStore checks version and build number for updates](https://faq.altstore.io/developers/updating-apps). A signer that only compares the marketing version may require you to select and reinstall the newer build manually while the app remains at `0.1.0`.

The publisher uploads a distinct IPA and icon for every build before replacing `source.json`. Cached sources retain valid downloads, and retrying an older workflow cannot downgrade the channel. Old assets remain downloadable. Each channel uses a rolling prerelease whose tag anchors its first build; read the source for the current version. Branch builds and widget experiment builds stay available as workflow artifacts and do not replace these sources. A failed publication can be retried without rebuilding the successful IPA.

The build excludes the widget extension. WIDGET-001 settled that a sideloaded IPA can carry a working widget, so the two-variant control build has done its job and stage 6 owns the rest. The app still carries its variant-specific App Group entitlement in both release and development binaries; only the widget extension is gated. To build one, dispatch the workflow manually and set the `widget` input, which passes `CARRYOVER_WIDGET=1` through to `app.config.js`.

Commits that touch only Markdown, `docs/`, or `.tasks/` do not build. Pushing twice cancels the first run for that branch and variant.

## Local UI development

Use the iPhone development build as your main feedback loop. The browser supports shared layout and style work:

```bash
npm run web
```

Expo opens the preview at `http://localhost:8081` and applies TypeScript, component, and style changes through Fast Refresh. Run `npm run web:export` when you need to verify the production browser bundle.

The browser displays an explicit preview notice. The current stage 0 screen only shows that signing facts are unavailable, so it verifies startup but offers little screen coverage. Add typed fixtures to shared components as product screens arrive. Keep this preview small. It does not open the ledger or load the iOS widget. Expo SQLite web support is alpha, and a browser database would create a second persistence environment without proving native SQLite behavior. Use database tests and the iPhone development build for storage behavior.

Use the iPhone development build when you need iOS rendering or native behavior:

1. Open the `iOS unsigned IPA` workflow in GitHub Actions and select **Run workflow**.
2. Set `development` to true. The widget extension stays disabled for this build, while the app keeps the `group.com.bbq.carryover.dev` entitlement used by the native shared-storage guard.
3. Refresh the Carryover Dev source in your signer, or download the `carryover-development-ipa` artifact and extract `carryover.ipa`. Sign and install it. Keep its identifier distinct from the release app if your signer rewrites identifiers. The app should appear as Carryover Dev beside Carryover.
4. Start Metro on this machine:

   ```bash
   npm run start:device
   ```

5. Keep the phone and this machine on the same network. Enable Developer Mode if iOS requests it and allow local network access. Open Carryover Dev and select the displayed development server. You can also scan Metro's QR code.

The workflow sets `CARRYOVER_VARIANT=development` for development builds. The Metro command sets the same value and uses the `carryover-dev` URL scheme. The development bundle identifier is `com.bbq.carryover.dev`, with `group.com.bbq.carryover.dev` as its App Group; release keeps `com.bbq.carryover` and `group.com.bbq.carryover`. Separate identities give each app its own ledger storage and shared container. Development always disables the widget extension, even if `CARRYOVER_WIDGET=1` is set. The release app keeps its existing URL configuration. This follows Expo's [app variant guidance](https://docs.expo.dev/build-reference/variants/).

After installing, confirm both apps still appear and Metro opens Carryover Dev. Once transaction screens exist, add a test transaction in Carryover Dev, restart both apps, and confirm it exists only in development. Use test data in Carryover Dev. An older development IPA used the release identifier; installing the new variant does not move that older app's data.

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

Run `npm test`, `npm run typecheck`, and `python3 -m unittest discover -s tests -p '*_test.py'` locally before pushing. The Python checks exercise source generation and publication order with temporary IPAs and a fake GitHub CLI; they do not upload releases. The existing SQLite tests already run on Linux. BUILD-002 migrated them to Jest and added React Native Testing Library; Linux CI runs the same fast checks before the macOS build.

BUILD-003 is deferred. Native device build checks keep their existing triggers, and no product stage depends on a separate Simulator build. Install the candidate IPA and run the manual release checks on the iPhone. See [App stack and testing](../app-stack-and-testing.md) for test ownership and the device checklist.

## What free signing cannot do

A free Apple ID signs an app for seven days, after which it stops launching until you refresh it.

App Groups do work on a free account, so the widget does not need the paid membership. It needs the right sideloader. **Use iloader.** AltStore and SideStore do not register the App Group, and the widget cannot work under them. See the [widget sideload result](widget-sideload-result.md) for the evidence and for the runtime resolution the app needs on top.

Local notifications work on a free build. Remote push does not.

A paid membership costs 99 USD per year and buys TestFlight, so another person can install without a computer or a weekly refresh, plus remote push. Neither is needed for v1.

## Dependency pinning

Both jobs run `npm ci` against the committed `package-lock.json`, so a build installs exactly what was resolved here.

`package.json` pins `react-dom` to react's version through an `overrides` entry. `@expo/ui` ships web components whose transitive `react-dom` peer resolves ahead of the react version Expo pins, and stock npm refuses the mismatch even though every consumer accepts `^19.0.0`. Holding `react-dom` at react's version fixes it without moving react off the SDK pin. Remove the override only after checking that `npm ci` still succeeds on a clean runner, because a local install can silently override a peer that CI rejects.
