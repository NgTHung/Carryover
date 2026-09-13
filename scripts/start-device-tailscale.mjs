// Advertise the private Tailscale address in manifests and development launch URLs.
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { isIPv4 } from 'node:net';

const require = createRequire(import.meta.url);
const host = execFileSync('tailscale', ['ip', '-4'], { encoding: 'utf8' }).trim();
if (!isIPv4(host)) throw new Error('Connect this machine to Tailscale before starting Metro.');

const args = process.argv.slice(2);
if (args.some((arg) => ['--localhost', '--tunnel', '--host'].some((flag) => arg === flag || arg.startsWith(`${flag}=`)))) {
  throw new Error('The Tailscale command requires LAN mode. Use start:device for other connection modes.');
}
console.log(`Open Carryover Dev and enter http://${host}:8081 (or your --port value).`);
const child = spawn(process.execPath, [require.resolve('expo/bin/cli'),
  'start', '--dev-client', '--scheme', 'carryover-dev', '--lan', ...args], {
  stdio: 'inherit',
  env: { ...process.env, CARRYOVER_VARIANT: 'development', REACT_NATIVE_PACKAGER_HOSTNAME: host },
});
child.on('error', (error) => { throw error; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
