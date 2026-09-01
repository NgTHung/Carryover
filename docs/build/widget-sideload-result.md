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

## Result

Status: question 1 answered, question 2 pending a rebuild.

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
