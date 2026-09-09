import { StyleSheet, Text, View } from 'react-native';

import { HomeRouteLink } from '../ui/HomeRouteLink';

export default function NotFoundScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>CARRYOVER · ROUTES</Text>
      <Text style={styles.title}>Page not found</Text>
      <Text style={styles.detail}>This route is not part of the app.</Text>
      <HomeRouteLink />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#0D1614',
    padding: 20,
    gap: 8,
  },
  eyebrow: { color: '#46C4A4', fontSize: 11, letterSpacing: 1.6, fontWeight: '600' },
  title: { color: '#E4EAE7', fontSize: 28, fontWeight: '700' },
  detail: { color: '#97AAA5', fontSize: 13, lineHeight: 19 },
});
