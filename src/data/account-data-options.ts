/** Shared options for account mutations that need an atomic runner or clock. */
import type { AtomicTransactionRunner } from './atomic';

export type AccountDataOptions<TResultKind extends 'sync' | 'async'> = {
  runAtomic?: AtomicTransactionRunner<TResultKind>;
  now?: () => Date;
};
