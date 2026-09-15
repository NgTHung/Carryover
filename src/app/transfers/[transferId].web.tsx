/** Browser fallback for a dedicated transfer detail route. */
import { router, useLocalSearchParams, type Href } from 'expo-router';

import { TransferRouteView, type TransferRouteState } from '../../ui/transfers/TransferRouteView';
import { parseTransferRoute } from '../../ui/transfers/transfer-route';

export default function TransferRouteWebScreen() {
  const { transferId } = useLocalSearchParams<{
    transferId?: string | string[];
  }>();
  const parsed = parseTransferRoute(transferId);
  const state: TransferRouteState =
    parsed.status === 'invalid'
      ? parsed
      : {
          status: 'unavailable',
          transferId: parsed.transferId,
          message: 'The browser preview does not open the ledger.',
        };

  return <TransferRouteView state={state} onBack={() => router.replace('/transactions' as Href)} />;
}
