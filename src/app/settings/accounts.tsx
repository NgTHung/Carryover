import { AccountReconcileScreen } from '../../ui/accounts/AccountReconcileScreen';
import { getAccountReconcileData } from '../../ui/ledger-access';

export default function AccountsRoute() {
  return <AccountReconcileScreen data={getAccountReconcileData()} />;
}

