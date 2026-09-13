// A short MagicDNS name works with the app's existing iOS local-network ATS exception.
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const status = JSON.parse(execFileSync('tailscale', ['status', '--json'], { encoding: 'utf8' }));
const host = status.Self?.DNSName?.split('.')[0];
if (status.BackendState !== 'Running' || !status.CurrentTailnet?.MagicDNSEnabled ||
    typeof host !== 'string' || !/^[a-z0-9][a-z0-9-]*$/i.test(host)) {
  throw new Error('Connect to Tailscale and enable MagicDNS before starting Metro.');
}

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
