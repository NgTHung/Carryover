/**
 * Makes expo-widgets resolve its App Group from the running binary instead of
 * from a build-time Info.plist key.
 *
 * Sideloading rewrites bundle identifiers and entitlements so App IDs stay
 * unique per account: com.bbq.carryover becomes com.bbq.carryover.<random>, and
 * the extension follows. It does not rewrite ExpoWidgetsAppGroupIdentifier,
 * because that key is expo-widgets' own invention and no signing tool knows it
 * exists. Both processes then ask for a group that was never granted, so
 * containerURL returns nil, UserDefaults(suiteName:) silently falls back to a
 * process-local store, and the extension finds no layout to draw.
 *
 * Reading the granted groups from the binary's entitlements fixes every signing
 * flow that rewrites identifiers, which is the normal case for a project with
 * no Mac.
 *
 * The patch asserts the exact upstream source it expects and fails loudly if
 * expo-widgets changes, so an upgrade cannot silently drop it.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const MARKER = 'CARRYOVER_APP_GROUP_PATCH';

function patch(file, edits) {
  const before = readFileSync(file, 'utf8');
  if (before.includes(MARKER)) {
    console.log(`[patch-expo-widgets] already patched: ${file}`);
    return;
  }
  let after = before;
  for (const [find, replace, count] of edits) {
    const occurrences = after.split(find).length - 1;
    if (occurrences !== count) {
      console.error(
        `[patch-expo-widgets] expected ${count} occurrence(s) in ${file}, found ${occurrences}.`
      );
      console.error('[patch-expo-widgets] expo-widgets changed upstream. Review the patch.');
      process.exit(1);
    }
    after = after.split(find).join(replace);
  }
  writeFileSync(file, after);
  console.log(`[patch-expo-widgets] patched ${file}`);
}

const storage = 'node_modules/expo-widgets/ios/WidgetsStorage.swift';
patch(storage, [
  [
    `public enum WidgetsStorage {
  public static var appGroupIdentifier: String? = Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String
  static let defaults = UserDefaults(suiteName: appGroupIdentifier)`,
    `import Foundation
import Security

// ${MARKER}
public enum WidgetsStorage {
  public static var appGroupIdentifier: String? = resolveAppGroupIdentifier()

  /// Signing tools rewrite identifiers but not the Info.plist key, so the
  /// configured name can point at a group that was never granted. Prefer a
  /// granted group whose container actually resolves.
  private static func resolveAppGroupIdentifier() -> String? {
    let configured = Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String

    if let configured, containerExists(configured) {
      return configured
    }

    guard let task = SecTaskCreateFromSelf(nil),
          let granted = SecTaskCopyValueForEntitlement(
            task, "com.apple.security.application-groups" as CFString, nil
          ) as? [String]
    else {
      return configured
    }

    return granted.first(where: containerExists) ?? configured
  }

  private static func containerExists(_ identifier: String) -> Bool {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier) != nil
  }

  static let defaults = UserDefaults(suiteName: appGroupIdentifier)`,
    1,
  ],
]);

const timeline = 'node_modules/expo-widgets/ios/Widgets/TimelineProvider.swift';
patch(timeline, [
  [
    `    let groupIdentifier =
      Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String`,
    `    // ${MARKER}: use the resolved group, not the build-time key.
    let groupIdentifier = WidgetsStorage.appGroupIdentifier`,
    2,
  ],
]);

console.log('[patch-expo-widgets] done');
