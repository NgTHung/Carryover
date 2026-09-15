/** Validates transfer deep links before they reach the public read contract. */
import { transferIdSchema, type TransferRead } from '../../data/transfer-reads';

export type ParsedTransferRoute =
  | { status: 'valid'; transferId: string }
  | { status: 'invalid'; message: string };

export type LoadedTransferRoute =
  | { status: 'invalid'; message: string }
  | { status: 'unavailable'; transferId: string }
  | { status: 'ready'; transfer: TransferRead };

export function parseTransferRoute(value: unknown): ParsedTransferRoute {
  const parsed = transferIdSchema.safeParse(value);
  return parsed.success
    ? { status: 'valid', transferId: parsed.data }
    : { status: 'invalid', message: 'This transfer link is invalid.' };
}

export async function loadTransferRoute(
  value: unknown,
  readTransfer: (transferId: string) => Promise<TransferRead | undefined>
): Promise<LoadedTransferRoute> {
  const parsed = parseTransferRoute(value);
  if (parsed.status === 'invalid') return parsed;
  const transfer = await readTransfer(parsed.transferId);
  return transfer === undefined
    ? { status: 'unavailable', transferId: parsed.transferId }
    : { status: 'ready', transfer };
}
