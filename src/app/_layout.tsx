/**
 * Native root layout for the Expo Router tree.
 *
 * The migration gate stays above the navigator so route screens cannot touch
 * the database until Drizzle has applied every migration.
 */
import '../../global.css';

import { Stack } from 'expo-router';

import { useLedgerMigrations } from '../ui/ledger-access';
import { MigrationStatus } from '../ui/MigrationStatus';

export default function RootLayout() {
  const { success, error } = useLedgerMigrations();

  if (error) {
    return <MigrationStatus message={`Migration failed: ${error.message}`} />;
  }

  if (!success) {
    return <MigrationStatus message="Applying the ledger schema…" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
