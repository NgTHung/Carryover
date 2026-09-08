/**
 * Native application entry point.
 *
 * The ledger must finish migrating before any native screen can use it. Web
 * has a separate entry point because its UI preview never opens the ledger.
 */
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

import { ledgerDb, ledgerMigrations } from './src/data/database';
import { MigrationStatus, StageZeroScreen } from './src/dev/StageZeroScreen';

export default function App() {
  const { success, error } = useMigrations(ledgerDb, ledgerMigrations);

  if (error) {
    return <MigrationStatus message={`Migration failed: ${error.message}`} />;
  }
  if (!success) {
    return <MigrationStatus message="Applying the ledger schema…" />;
  }
  return <StageZeroScreen />;
}
