/**
 * Removes the push entitlement from every generated entitlements file.
 *
 * expo-widgets writes `aps-environment` even with `enablePushNotifications`
 * disabled, and it writes it after config plugins run, so a withEntitlementsPlist
 * plugin sees an empty object and its deletion is overwritten. Post-processing
 * the generated files is deterministic and ios/ is throwaway output anyway.
 *
 * Apple gates push behind the paid Developer Program. v1 uses local
 * notifications, so the entitlement buys nothing and gives a free-account
 * sideload one more capability it cannot provision.
 *
 * Delete this script when remote push becomes a real feature.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const KEY = 'aps-environment';

function findEntitlements(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'Pods' || entry === 'build') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...findEntitlements(full));
    else if (entry.endsWith('.entitlements')) found.push(full);
  }
  return found;
}

const files = findEntitlements('ios');
let stripped = 0;

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  if (!before.includes(KEY)) continue;

  // Remove the <key> line and the <string> value that follows it.
  const after = before.replace(
    /^[ \t]*<key>aps-environment<\/key>\s*\n[ \t]*<string>[^<]*<\/string>[ \t]*\n/m,
    ''
  );

  if (after === before) {
    console.error(`[strip-push-entitlement] found ${KEY} in ${file} but could not remove it`);
    process.exit(1);
  }

  writeFileSync(file, after);
  console.log(`[strip-push-entitlement] removed ${KEY} from ${file}`);
  stripped += 1;
}

console.log(
  `[strip-push-entitlement] scanned ${files.length} file(s), stripped ${stripped}`
);
