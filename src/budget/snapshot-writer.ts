/** Writes the complete snapshot through expo-widgets shared storage. */
import type { BudgetSnapshot } from './snapshot';

export function writeSharedSnapshot(snapshot: BudgetSnapshot): void {
  // Keep the iOS module behind the write edge so route discovery and tests can
  // load the application service without requiring a native widget runtime.
  const { CarryoverWidget } = require('../../widgets/CarryoverWidget') as typeof import('../../widgets/CarryoverWidget');
  CarryoverWidget.updateSnapshot(snapshot);
}
