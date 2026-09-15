/** The one account form interaction allowed on the Accounts screen. */
export type AccountInteraction =
  | { status: 'closed' }
  | {
      status: 'editing-details';
      accountId: string;
      name: string;
      openingBalance: string;
      error?: string;
    }
  | {
      status: 'saving-details';
      accountId: string;
      name: string;
      openingBalance: string;
    }
  | {
      status: 'reconciling';
      accountId: string;
      statedBalance: string;
      error?: string;
    }
  | {
      status: 'saving-reconcile';
      accountId: string;
      statedBalance: string;
    };
