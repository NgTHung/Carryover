// Continuous native generation: ios/ is regenerated on every prebuild, so this
// file is the only place iOS configuration exists.
//
// The widget is off until build:WIDGET-002. WIDGET-001 proved the extension
// installs but left a stale-render question open, so building it on every push
// spends macOS minutes on a target nothing consumes yet. Set CARRYOVER_WIDGET=1
// to opt back in.
const widgetEnabled = process.env.CARRYOVER_WIDGET === '1';

const BUNDLE_ID = 'com.bbq.carryover';

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

module.exports = {
  expo: {
    name: 'Carryover',
    slug: 'carryover',
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
    plugins: widgetEnabled ? [widgetPlugin] : [],
  },
};
