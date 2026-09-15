/** Native data contracts used by transfer creation and detail screens. */
import type { ActiveAccount } from '../../data/accounts';
import type { RecordTransfer } from '../../data/account-validation';
import type { TransferRead } from '../../data/transfer-reads';

export type TransferCreationData = {
  listActiveAccounts(): Promise<ActiveAccount[]>;
  recordTransfer(input: RecordTransfer): Promise<void>;
};

export type TransferDetailData = {
  readTransfer(transferId: string): Promise<TransferRead | undefined>;
};
