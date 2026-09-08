/**
 * Native root layout for the Expo Router tree.
 *
 * The migration gate stays above the navigator so route screens cannot touch
 * the database until Drizzle has applied every migration.
 */
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';

import { ledgerDb, ledgerMigrations } from '../data/database';
import { MigrationStatus } from './MigrationStatus';

export default function RootLayout() {
  const { success, error } = useMigrations(ledgerDb, ledgerMigrations);

  if (error) {
    return <MigrationStatus message={`Migration failed: ${error.message}`} />;
  }

  if (!success) {
    return <MigrationStatus message="Applying the ledger schema…" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
