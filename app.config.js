// Continuous native generation: ios/ is regenerated on every prebuild, so this
// file is the only place iOS configuration exists.
//
// CARRYOVER_WIDGET=0 drops the widget plugin. The build:WIDGET-001 spike needs a
// widget-free IPA to prove the pipeline before the widget can be blamed for a
// signing failure.
const widgetEnabled = process.env.CARRYOVER_WIDGET !== '0';

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
