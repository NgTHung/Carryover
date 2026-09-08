/**
 * Web root layout for the Expo Router tree.
 *
 * The browser preview has no ledger connection, so it mounts navigation
 * without importing the native migration boundary.
 */
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
