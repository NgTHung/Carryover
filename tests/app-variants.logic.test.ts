import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const projectRoot = resolve(__dirname, '..');

function config(variant: string | undefined, widget = '0'): unknown {
  const env: NodeJS.ProcessEnv = { ...process.env, CARRYOVER_WIDGET: widget };
  delete env.CARRYOVER_VARIANT;
  if (variant !== undefined) env.CARRYOVER_VARIANT = variant;

  return JSON.parse(
    execFileSync(process.execPath, ['-e', 'console.log(JSON.stringify(require("./app.config.js").expo))'], {
      cwd: projectRoot,
      env,
      encoding: 'utf8',
    })
  );
}

test('default and explicit release preserve the installed app identity', () => {
  const release = config(undefined);
  expect(release).toEqual(config('release'));
  expect(release).toMatchObject({
    name: 'Carryover',
    ios: { bundleIdentifier: 'com.bbq.carryover' },
    plugins: ['expo-sqlite'],
  });
  expect(release).not.toHaveProperty('scheme');
});

test.each(['0', '1'])('development isolates installation and launch with widget=%s', (widget) => {
  expect(config('development', widget)).toMatchObject({
    name: 'Carryover Dev',
    scheme: 'carryover-dev',
    ios: { bundleIdentifier: 'com.bbq.carryover.dev' },
    plugins: ['expo-sqlite', ['expo-dev-client', { addGeneratedScheme: false }]],
  });
});

test('release can still opt into the existing widget identity', () => {
  expect(config('release', '1')).toMatchObject({
    plugins: expect.arrayContaining([
      ['expo-widgets', expect.objectContaining({
        bundleIdentifier: 'com.bbq.carryover.widgets',
        groupIdentifier: 'group.com.bbq.carryover',
      })],
    ]),
  });
});

test('a misspelled variant fails instead of silently selecting the release ledger', () => {
  const result = spawnSync(process.execPath, ['-e', 'require("./app.config.js")'], {
    cwd: projectRoot,
    env: { ...process.env, CARRYOVER_VARIANT: 'developmnt' },
    encoding: 'utf8',
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('Unknown CARRYOVER_VARIANT: developmnt');
});
