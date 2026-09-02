# Widget sideload result

A sideloaded IPA can drive a home screen widget on a free Apple account, but only with iloader and only with the App Group resolved at runtime. This document records how that was established and the two reasoning traps that produced wrong answers along the way.

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

**A sideloaded IPA can drive a home screen widget on a free Apple account.** Two things are required together, and either alone fails.

### 1. Sideload with iloader

iloader registers the App Group. AltStore and SideStore do not, so the widget cannot work under them no matter how the app is built. This is a project constraint rather than a preference.

Every sideloader rewrites bundle identifiers so App IDs stay unique per Apple account, appending the team identifier:

| | Built | Installed |
| --- | --- | --- |
| App | `com.bbq.carryover` | `com.bbq.carryover.<TEAM>` |
| Extension | `com.bbq.carryover.widgets` | `com.bbq.carryover.<TEAM>.widgets` |
| App Group | `group.com.bbq.carryover` | `group.com.bbq.carryover.<TEAM>` |

The team identifier is stable for an Apple ID, so the rewritten names are stable across installs. Do not hardcode one. It changes with the account, and it would break the moment a paid membership or a different Apple ID is used.

### 2. Resolve the App Group at runtime

`expo-widgets` reads the group name from `ExpoWidgetsAppGroupIdentifier`, a custom Info.plist key written at build time. No signing tool rewrites it, because no signing tool knows it exists. So even under iloader, the app and the extension ask for `group.com.bbq.carryover` while the grant is `group.com.bbq.carryover.<TEAM>`.

`scripts/patch-expo-widgets.mjs` makes both processes read the granted groups from their own `embedded.mobileprovision` and prefer one whose container resolves, falling back to the configured value. A normal Xcode build is unaffected, because the configured name resolves there and is used as-is.

`TimelineProvider` read the Info.plist key directly in two more places, bypassing `WidgetsStorage`, so it goes through the resolver as well.

## How the earlier conclusions went wrong

Recorded because the reasoning traps here are easy to fall back into.

`UserDefaults(suiteName:)` does not fail when the entitlement is missing. It returns a store backed by a process-local file, so the app writes a timeline and reads the same timeline back without ever touching the shared container. A round trip inside the app proves nothing. It fails open.

`FileManager.containerURL(forSecurityApplicationGroupIdentifier:)` returns nil when the group is not granted. It fails closed, so it is the honest probe. Use it, not a round trip.

WidgetKit's "Please adopt containerBackground API" was a symptom three steps from the cause. With no layout in the shared store, `EntryView` renders `createRedBox(...)`, that red box carries no container background, and WidgetKit substitutes its own placeholder. The Carryover component never rendered at any point, which is why adopting the modifier changed nothing visible. The modifier is still required.

Twice this was called a paid-membership problem. It never was. The capability was present and under a different name, and the evidence for the wrong conclusion came from a check that fails open.

## Where this stopped

The widget does not render, and the cause was not settled.

A bright container background and a background on the library's red box both failed to appear on device, across several builds and two signers. Neither visual change showed, which points at the extension running stale code rather than at the group plumbing. Widget extensions are cached hard, and the layout string itself lives in the shared store, so an old install's layout can keep drawing after the app is replaced.

Retry from a clean device before changing any code. Remove the widget, delete the app, reboot the phone, reinstall, open the app, then re-add the widget. If a colour change still does not appear, the extension is not receiving new code and that is an install problem.

Under the FlareStore certificate the widget drew black, which is the previous ground colour, so a stale layout is the most likely explanation. Under iloader it drew WidgetKit's placeholder, meaning no layout at all.

The FlareStore profile grants App Groups and `aps-environment` set to `production`, so it is a genuine paid-team profile and the widget was legitimately provisioned under it. Push is granted but not usable, because sending needs an APNs key for an App ID owned by the signing service.

## What still needs the paid membership

TestFlight, so another person can install without a computer and without a weekly refresh. Remote push. Neither is needed for v1.
