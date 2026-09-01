# Carryover Project Instructions

Claude Code loads this file automatically. The shared engineering rules for every agent tool live in `AGENTS.md` and are imported below. Edit those rules in `AGENTS.md`, not here. The sections after the import are specific to Claude Code.

@AGENTS.md

## Claude Code Notes

### Build environment

Node comes from `nub`, an all-in-one Node toolkit that manages the runtime and shims the package managers. `node`, `npm`, and `npx` resolve through `~/.nub/node-shim` and `~/.nub/shims`, which are already on PATH. Run `npm install` and `npm run typecheck` directly. You do not need to prefix anything with `nub`.

Use `nub` itself when you want its own commands, such as `nub add` to install a dependency, `nub dlx <pkg>` to fetch and run a package binary, or `nub node ls` to see installed runtimes.

Do not run `create-expo-app`. It parses the output of `npm pack --dry-run`, and npm 12 changed that output from an array to an object, so it fails with a JSON parse error. Pull a template tarball with `npm pack expo-template-blank-typescript@latest` and extract it instead.

`ls` is aliased to `eza` with git integration. It crawls in a directory that has `node_modules`. Use `/bin/ls` or `find` in scripts.

There is no Mac. You cannot run Xcode, a simulator, `xcodebuild`, or `pod install`. iOS builds happen on the `macos` runner in `.github/workflows/ios.yml` and nowhere else. `expo prebuild` generates a native project but cannot compile one here.

### Verification

You can typecheck locally, so do it. `npm run typecheck` compiles every file in the project against real package types and is the cheapest way to catch a wrong API before a macOS runner starts.

You cannot verify anything that needs a device or a build. Camera permissions, safe area insets, widget installation, and App Group provisioning only fail on a phone, after CI. Be precise about which half of a change you have actually checked, and say plainly when something is written but unproven.

### Task tracking

Run `taskroot validate` after any change under `.tasks/`. The binary is installed and works offline.

Check off an acceptance criterion only when it is genuinely satisfied. A criterion that needs a real build or a real phone stays unchecked until someone runs one.
