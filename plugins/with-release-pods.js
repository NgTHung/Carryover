/**
 * Excludes the development launcher and menu from the release native project.
 * Use Expo's exclusion option so its generated module provider agrees with
 * CocoaPods about which modules exist. Keep their shared interfaces available.
 */
const { withPodfile } = require('expo/config-plugins');

const excludedModules = ['expo-dev-client', 'expo-dev-launcher', 'expo-dev-menu'];

function excludeDevelopmentPods(contents) {
  const invocation = /^([ \t]*)use_expo_modules![ \t]*$/gm;
  if ([...contents.matchAll(invocation)].length !== 1) {
    throw new Error('Expected one plain use_expo_modules! call. Review the Expo Podfile template.');
  }
  return contents.replace(
    invocation,
    `$1use_expo_modules!(:exclude => ${JSON.stringify(excludedModules)})`
  );
}

module.exports = (config) => withPodfile(config, (mod) => {
  mod.modResults.contents = excludeDevelopmentPods(mod.modResults.contents);
  return mod;
});

module.exports.excludeDevelopmentPods = excludeDevelopmentPods;
module.exports.excludedModules = excludedModules;
