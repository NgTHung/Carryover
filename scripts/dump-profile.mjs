/**
 * Prints what a provisioning profile actually grants.
 *
 * Signing services hand out a profile plus a p12 without saying which
 * capabilities come with them, and the entitlements in the profile are the
 * authority. A capability absent here cannot be added from this end, because
 * the App ID belongs to the service rather than to you.
 *
 * Usage: node scripts/dump-profile.mjs <path to .mobileprovision>
 */
import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/dump-profile.mjs <path to .mobileprovision>');
  process.exit(1);
}

// The file is a CMS envelope wrapping a plain XML plist.
const raw = readFileSync(path, 'latin1');
const start = raw.indexOf('<?xml');
const end = raw.indexOf('</plist>');
if (start === -1 || end === -1) {
  console.error('No plist found. Is this a .mobileprovision?');
  process.exit(1);
}
const xml = raw.slice(start, end + '</plist>'.length);

/** Minimal plist reader: enough for the scalar and array fields that matter. */
function valueFor(key) {
  const at = xml.indexOf(`<key>${key}</key>`);
  if (at === -1) return null;
  const rest = xml.slice(at + key.length + 11);
  const tag = rest.match(/<(\w+)/);
  if (!tag) return null;
  if (tag[1] === 'array') {
    const arr = rest.slice(0, rest.indexOf('</array>'));
    return [...arr.matchAll(/<string>([^<]*)<\/string>/g)].map((m) => m[1]);
  }
  if (tag[1] === 'true' || tag[1] === 'false') return tag[1];
  const scalar = rest.match(/<(?:string|integer|date)>([^<]*)</);
  return scalar ? scalar[1] : null;
}

const ent = xml.slice(xml.indexOf('<key>Entitlements</key>'));
const entKeys = [...ent.matchAll(/<key>([^<]+)<\/key>/g)].map((m) => m[1]).slice(1);

console.log('PROFILE');
for (const key of ['Name', 'TeamName', 'TeamIdentifier', 'AppIDName', 'CreationDate', 'ExpirationDate']) {
  const v = valueFor(key);
  console.log(`  ${key.padEnd(16)} ${Array.isArray(v) ? v.join(', ') : v ?? '(none)'}`);
}

const devices = valueFor('ProvisionedDevices');
console.log(`  ${'Devices'.padEnd(16)} ${Array.isArray(devices) ? `${devices.length} registered` : 'none (distribution profile)'}`);

console.log('\nENTITLEMENTS');
for (const key of [...new Set(entKeys)].sort()) {
  const at = ent.indexOf(`<key>${key}</key>`);
  const after = ent.slice(at + key.length + 11, at + key.length + 400);
  const tag = after.match(/<(\w+)/)?.[1];
  let shown;
  if (tag === 'array') {
    shown = [...after.slice(0, after.indexOf('</array>')).matchAll(/<string>([^<]*)<\/string>/g)]
      .map((m) => m[1])
      .join(', ');
  } else if (tag === 'true' || tag === 'false') {
    shown = tag;
  } else {
    shown = after.match(/<(?:string|integer)>([^<]*)</)?.[1] ?? '(complex)';
  }
  console.log(`  ${key}\n    ${shown}`);
}
