/**
 * Makes expo-widgets resolve its App Group from the running binary, and exposes
 * the signing facts needed to debug when it cannot.
 *
 * Sideloading rewrites bundle identifiers and entitlements so App IDs stay
 * unique per Apple account: com.bbq.carryover becomes com.bbq.carryover.<team>,
 * and the extension follows. Nothing rewrites ExpoWidgetsAppGroupIdentifier,
 * because that key is expo-widgets' own invention and no signing tool knows it
 * exists. Both processes then ask for a group that was never granted, so
 * containerURL returns nil, UserDefaults(suiteName:) falls back to a
 * process-local store, and the extension finds no layout to draw.
 *
 * The patch asserts the exact upstream source it expects and fails the build if
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

patch('node_modules/expo-widgets/ios/WidgetsStorage.swift', [
  [
    `public enum WidgetsStorage {
  public static var appGroupIdentifier: String? = Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String
  static let defaults = UserDefaults(suiteName: appGroupIdentifier)`,
    `import Foundation

// ${MARKER}
public enum WidgetsStorage {
  public static var appGroupIdentifier: String? = resolveAppGroupIdentifier()

  public static var configuredAppGroupIdentifier: String? {
    Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String
  }

  /// Signing tools rewrite identifiers but not the Info.plist key, so the
  /// configured name can point at a group that was never granted. Prefer a
  /// granted group whose container actually resolves.
  private static func resolveAppGroupIdentifier() -> String? {
    let configured = configuredAppGroupIdentifier
    if let configured, containerExists(configured) {
      return configured
    }
    // Sort before choosing. The app and the extension read separate profiles,
    // and a signer that grants several generic groups can list them in
    // different orders, which would leave the two processes on different
    // containers with no shared store between them.
    return grantedAppGroups().sorted().first(where: containerExists) ?? configured
  }

  public static func containerExists(_ identifier: String) -> Bool {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier) != nil
  }

  public static func containerPath(_ identifier: String?) -> String? {
    guard let identifier else { return nil }
    return FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: identifier)?.path
  }

  /// SecTask entitlement APIs are macOS only, so read the profile this binary
  /// was signed with. The app and the extension each carry their own copy, so
  /// both processes resolve the same granted group.
  public static func embeddedProfile() -> [String: Any]? {
    guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
          let data = try? Data(contentsOf: url),
          let text = String(data: data, encoding: .isoLatin1),
          let start = text.range(of: "<?xml"),
          let end = text.range(of: "</plist>"),
          // The profile is CMS signed, so slice the plain plist out of the envelope.
          let plistData = String(text[start.lowerBound..<end.upperBound]).data(using: .isoLatin1)
    else {
      return nil
    }
    return try? PropertyListSerialization.propertyList(
      from: plistData, options: [], format: nil
    ) as? [String: Any]
  }

  public static func grantedAppGroups() -> [String] {
    guard let entitlements = embeddedProfile()?["Entitlements"] as? [String: Any],
          let groups = entitlements["com.apple.security.application-groups"] as? [String]
    else {
      return []
    }
    return groups
  }

  /// Everything the spike screen needs to explain a widget that will not draw.
  public static func signingFacts() -> [String: Any] {
    let profile = embeddedProfile()
    let entitlements = (profile?["Entitlements"] as? [String: Any]) ?? [:]

    var entitlementText: [String: String] = [:]
    for (key, value) in entitlements {
      entitlementText[key] = String(describing: value)
        .replacingOccurrences(of: "\\n", with: " ")
    }

    let granted = grantedAppGroups()
    return [
      "bundleIdentifier": Bundle.main.bundleIdentifier ?? "(nil)",
      "configuredAppGroup": configuredAppGroupIdentifier ?? "(nil)",
      "resolvedAppGroup": appGroupIdentifier ?? "(nil)",
      "grantedAppGroups": granted,
      "grantedAppGroupsResolving": granted.filter(containerExists),
      "containerPath": containerPath(appGroupIdentifier) ?? "(nil)",
      "profileFound": profile != nil,
      "profileName": profile?["Name"] as? String ?? "(nil)",
      "teamIdentifier": (profile?["TeamIdentifier"] as? [String])?.first ?? "(nil)",
      "entitlementKeys": Array(entitlements.keys).sorted(),
      "entitlements": entitlementText,
    ]
  }

  static let defaults = UserDefaults(suiteName: appGroupIdentifier)`,
    1,
  ],
]);

patch('node_modules/expo-widgets/ios/Widgets/TimelineProvider.swift', [
  [
    `    let groupIdentifier =
      Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String`,
    `    // ${MARKER}: use the resolved group, not the build-time key.
    let groupIdentifier = WidgetsStorage.appGroupIdentifier`,
    2,
  ],
]);

patch('node_modules/expo-widgets/ios/WidgetsModule.swift', [
  [
    `    Constant("widgetsDirectory") { () -> String? in`,
    `    // ${MARKER}
    Constant("signingFacts") { () -> [String: Any] in
      WidgetsStorage.signingFacts()
    }

    Constant("widgetsDirectory") { () -> String? in`,
    1,
  ],
]);

console.log('[patch-expo-widgets] done');
