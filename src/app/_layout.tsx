/**
 * Native root layout for the Expo Router tree.
 *
 * The migration gate stays above the navigator so route screens cannot touch
 * the database until Drizzle has applied every migration.
 */
import '../../global.css';

import { Stack } from 'expo-router';
import { useEffect } from 'react';

import {
  startBudgetSnapshotPublication,
  useLedgerMigrations,
} from '../ui/ledger-access';
import { MigrationStatus } from '../ui/MigrationStatus';
import { DraftNudgeLifecycle } from '../ui/notifications/DraftNudgeLifecycle';

export default function RootLayout() {
  const { success, error } = useLedgerMigrations();

  useEffect(() => {
    if (!success) {
      return undefined;
    }
    return startBudgetSnapshotPublication();
  }, [success]);

  if (error) {
    return <MigrationStatus message={`Migration failed: ${error.message}`} />;
  }

  if (!success) {
    return <MigrationStatus message="Applying the ledger schema…" />;
  }

  return (
    <>
      <DraftNudgeLifecycle />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
