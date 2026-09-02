# Widget sideload result

This document records what the stage 0 spike found. Fill it in after you sideload the build. Until then the questions below are open, and no product work should assume an answer.

## The questions

A widget extension and the data it renders are two separate problems, and they fail for different reasons. The spike separates them so one failure does not hide the other.

**Question 1. Does a sideloaded IPA carry a widget extension at all?** The widget component falls back to fixture values, so it draws even when the app has never sent it anything. If the Carryover widget appears in the widget gallery and shows the fixture figure, the answer is yes.

**Question 2. Can the app push data to it?** The spike screen has a button that calls `updateSnapshot` with a random value and then reloads the widget. If the widget number changes, the App Group data path works on your signing setup. If the call throws, the error text appears on screen.

## What CI already answered

These were settled by inspecting the built IPA, before any phone was involved.

The widget extension reaches the bundle. `carryover-widget.ipa` contains `Payload/Carryover.app/PlugIns/ExpoWidgetsTarget.appex` with bundle identifier `com.bbq.carryover.widgets` and `NSExtensionPointIdentifier` of `com.apple.widgetkit-extension`. The plain variant contains no `PlugIns` directory. The widget build is 11MB against 8.9MB for plain. A widget that fails to appear on device is therefore a signing or installation problem, not a build problem.

The build requires exactly one gated capability. Both generated entitlements files request `com.apple.security.application-groups` for `group.com.bbq.carryover` and nothing else.

`expo-widgets` also wrote `aps-environment` despite `enablePushNotifications: false`. Push is paid-only and v1 uses local notifications, so that entitlement raised the signing bar for nothing. `scripts/strip-push-entitlement.mjs` removes it after every prebuild. A config plugin cannot do this, because expo-widgets writes the file after config plugins run and a `withEntitlementsPlist` mod sees an empty object.

So the App Group is the single capability standing between this build and a free-account sideload.

## What the phone answered

Question 1 is settled: **yes, a sideloaded IPA carries a working widget extension.**

The widget build installed, the app launched, and the Carryover widget appeared in the widget gallery and could be placed on the home screen. It first drew WidgetKit's placeholder text, "Please adopt containerBackground API", which is the strongest possible evidence for question 1. That message comes from WidgetKit itself after it has loaded and executed the extension, so the extension was installed, signed acceptably, and running.

The App Group entitlement did not block installation. That was the single gated capability in the build and the expected reason for a failure, and it did not stop the sideload.

Since iOS 17 a widget must declare its background with the `containerBackground` modifier or WidgetKit refuses to draw its content. The first build did not, so it drew the placeholder instead. `containerBackground(color, 'widget')` from `@expo/ui/swift-ui/modifiers` fixes it, and the widget now commits to one dark ground with explicit foreground colours.

Question 2, whether the app can push data across the App Group, is still open. The widget could not render its own content, so the push button had nothing to change. Rebuild, sideload again, and tap it.

## How the widget actually gets its code

Worth knowing before debugging an empty widget, because it is not what the file layout suggests.

`ExpoWidgetsTarget.appex` contains `ExpoWidgets.bundle`, but that bundle is a generic runtime shell. It holds `@expo/ui`, the expo-widgets globals, and nothing of yours. Your widget component is not compiled into the extension.

The layout function ships in the app's `main.jsbundle` and is handed to native at runtime. `createWidget(name, fn)` calls `new ExpoWidgetsModule.Widget(name, layout)`, and the `'widget'` directive lets that function be serialized across to the extension, which evaluates it as `__expoWidgetLayout`.

The consequence: **the app must be launched at least once before the widget can render anything.** Registration happens when the module containing `createWidget` is first imported and run. A widget added to the home screen before the app has ever been opened has no layout to draw. `App.tsx` imports the widget module for exactly this reason, so opening the app registers it.

Two debugging notes follow from this. Searching the appex for your own strings proves nothing, because they are never there. And `main.jsbundle` is Hermes bytecode, so `grep` finds nothing in it. Use `strings main.jsbundle | grep ...` instead.

## Result

Status: answered. A sideloaded IPA carries a working widget extension. It cannot receive data, because free-account signing does not provision the App Group. The widget needs the paid membership.

Signing tool: SideStore. Account type: free Apple ID. Both "Use main profile" and "Register App ID for Each Extension" were tried, with identical results.

| Question | Result |
| --- | --- |
| Widget extension reaches the bundle | yes |
| Build requests only the App Group | yes |
| Widget installs, appears in the gallery, executes | yes |
| App Group container resolves | **no** |
| App Group carries data to the extension | **no** |

## Why the widget shows a container background error

The message is a symptom three steps removed from the cause. The chain, read from the Swift that expo-widgets ships:

`widgetsDirectory` calls `FileManager.containerURL(forSecurityApplicationGroupIdentifier:)`, which returns nil without the entitlement. That is why the container check reports no path, and it is the reliable signal because it fails closed.

`WidgetsStorage` holds `UserDefaults(suiteName: appGroupIdentifier)`. That initialiser does not fail when the entitlement is missing. It returns a store backed by a process-local file, so the app writes a timeline and reads the same timeline back without ever touching the shared container. A round trip inside the app therefore proves nothing about the App Group, and this check fails open.

The two results together are only consistent with the fallback: one identifier produced nil from `containerURL` and a working store from `UserDefaults(suiteName:)` on the same device in the same run.

The widget extension is a separate process with its own empty fallback store. `EntryView` looks for `__expo_widgets_<name>_layout`, finds nothing, and renders `createRedBox("No layout found for ...")`. That red box carries no `containerBackground`, so WidgetKit refuses to draw it and substitutes its own placeholder text.

So the widget never rendered the Carryover component at any point. Adopting `containerBackground` was correct and necessary, and it changed nothing, because the view on screen belonged to the library rather than to this app.

## Roadmap consequence

The widget stays at stage 6, as originally planned, and it now has a known price rather than an unknown risk. Buy the 99 USD membership when the widget is the next thing worth building. That same purchase covers TestFlight for another person and remote push, neither of which v1 needs.

Nothing before stage 6 depends on this. Ship the daily local notification as the glanceable surface in the meantime. It reads the same snapshot, works on a free account, and needs no extension.

Do not spend more time on the widget under free signing. The blocker is an Apple entitlement, not a bug in this project or in expo-widgets, and no amount of configuration works around it.

## Notes for whoever revisits this

Test the App Group with `widgetsDirectory`, never with a timeline round trip. One fails closed and the other fails open.

If the widget draws a red box after the membership is bought, that is progress and not a regression. The red box means the extension is reading the shared store and reporting what it found.

| Question | Result | Evidence |
| --- | --- | --- |
| Widget extension reaches the bundle | yes | `PlugIns/ExpoWidgetsTarget.appex` in the IPA |
| Build requests only the App Group | yes | both `.entitlements` files, after the strip script |
| Widget variant installs and launches | yes | installed by sideload, app opened |
| Widget appears in the gallery | yes | placed on the home screen |
| App Group entitlement blocks signing | no | the only gated capability, and it did not stop install |
| Widget renders the fixture figure | pending | first build drew the containerBackground placeholder |
| `updateSnapshot` succeeds | | |
| Widget number changes after push | | |

Signing tool used:

Apple account type (free or paid):

Error text, if any:

## What each outcome means

If the plain variant installs and the widget variant does not, the widget extension is the cause. Check the entitlements dump in the workflow step summary. An App Group entitlement that a free personal team cannot provision is the most likely reason.

If both install but the widget never appears in the gallery, the extension did not reach the bundle. That is a build problem. The workflow step summary lists every `.appex` in the packaged IPA, so check there before blaming signing.

If the widget appears and shows the fixture but the push fails, question 1 is answered yes and question 2 is answered no. The widget is viable, but it cannot receive data until the App Group is provisioned, which means the paid membership.

If both work on a free account, that is a better result than expected and the 99 USD purchase can wait until TestFlight or push notifications are needed.
