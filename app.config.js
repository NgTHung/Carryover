// Continuous native generation: ios/ is regenerated on every prebuild, so this
// file is the only place iOS configuration exists.
//
// The widget is off until build:WIDGET-002. WIDGET-001 proved the extension
// installs but left a stale-render question open, so building it on every push
// spends macOS minutes on a target nothing consumes yet. Set CARRYOVER_WIDGET=1
// to opt back in.
const variant = process.env.CARRYOVER_VARIANT ?? 'release';
if (variant !== 'release' && variant !== 'development') {
  throw new Error(`Unknown CARRYOVER_VARIANT: ${variant}. Use release or development.`);
}
const development = variant === 'development';
const widgetEnabled = !development && process.env.CARRYOVER_WIDGET === '1';

const BUNDLE_ID = development ? 'com.bbq.carryover.dev' : 'com.bbq.carryover';

const widgetPlugin = [
  'expo-widgets',
  {
    bundleIdentifier: `${BUNDLE_ID}.widgets`,
    groupIdentifier: `group.${BUNDLE_ID}`,
    enablePushNotifications: false,
    widgets: [
      {
        name: 'CarryoverWidget',
        displayName: 'Carryover',
        description: 'What you can spend today.',
        supportedFamilies: ['systemSmall'],
      },
    ],
  },
];

const plugins = ['expo-sqlite'];
if (development) {
  // The default exp+carryover scheme also belongs to the release app.
  plugins.push(['expo-dev-client', { addGeneratedScheme: false }]);
}
if (widgetEnabled) {
  plugins.push(widgetPlugin);
}

module.exports = {
  expo: {
    name: development ? 'Carryover Dev' : 'Carryover',
    slug: 'carryover',
    ...(development ? { scheme: 'carryover-dev' } : {}),
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0D1614',
    },
    ios: {
      bundleIdentifier: BUNDLE_ID,
      supportsTablet: false,
    },
    plugins,
  },
};
