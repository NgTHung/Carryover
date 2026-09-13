import { execFileSync } from 'node:child_process';

const { excludeDevelopmentPods, excludedModules } = require('../plugins/with-release-pods') as {
  excludeDevelopmentPods: (contents: string) => string;
  excludedModules: string[];
};

test('the installed Expo template supports the release exclusion without changing other pods', () => {
  const template = execFileSync('tar', [
    '-xOf', 'node_modules/expo/template.tgz', 'package/ios/Podfile',
  ], { encoding: 'utf8' });
  const patched = excludeDevelopmentPods(template);
  expect(patched).toContain(`use_expo_modules!(:exclude => ${JSON.stringify(excludedModules)})`);
  expect(patched.replace(/use_expo_modules!\(:exclude => .*\)/, 'use_expo_modules!')).toBe(template);
});

test.each([
  'use_expo_modules!(:exclude => ["another-module"])',
  'use_expo_modules!\nuse_expo_modules!',
  'use_react_native!',
])('a changed Podfile fails instead of silently retaining development pods: %s', (contents) => {
  expect(() => excludeDevelopmentPods(contents)).toThrow('Review the Expo Podfile template');
});

test('release autolinking retains snapshot storage and its native UI dependency', () => {
  const result: { modules: { packageName: string }[] } = JSON.parse(execFileSync(
    process.execPath,
    ['node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js',
      'resolve', '--platform', 'apple', '--json', '--exclude', ...excludedModules],
    { encoding: 'utf8' }
  ));
  const names = result.modules.map((module) => module.packageName);
  expect(names).toEqual(expect.arrayContaining(['expo-widgets', '@expo/ui', 'expo-sqlite']));
  for (const name of excludedModules) expect(names).not.toContain(name);
});
