/**
 * Contracts for the unknown-draft reminder boundary.
 *
 * The app owns the reminder policy, while this file describes the small
 * native-shaped surface the policy and service are allowed to use. Keeping
 * native types out of the contract lets the service run in logic tests and
 * gives the browser a deliberate unavailable implementation.
 */

export type DraftNudgePayload = {
  kind: 'carryover-unknown-drafts';
  version: 1;
  route: '/drafts';
};

export type DraftNudgePermission =
  | { status: 'allowed'; quiet: boolean }
  | { status: 'requestable'; canAskAgain: boolean }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'unavailable'; message: string };

export type DraftNudgeSchedule = {
  identifier: string;
  title: string;
  body: string;
  data: DraftNudgePayload;
  trigger: {
    kind: 'daily';
    hour: number;
    minute: number;
  };
};

export type DraftNudgeNotificationSound = 'none' | 'default' | 'custom';

export type DraftNudgeScheduledTrigger =
  | {
      kind: 'daily';
      repeats: boolean;
      hour: number;
      minute: number;
    }
  | {
      kind: 'other';
      nativeType: string;
      repeats: boolean;
    };

export type DraftNudgeScheduledRequest = {
  identifier: string;
  content: {
    title: string | null;
    body: string | null;
    data: unknown;
    sound: DraftNudgeNotificationSound;
    badge: number | null;
  };
  trigger: DraftNudgeScheduledTrigger;
};

export type DraftNudgeResponse = {
  requestIdentifier: string;
  deliveredAt: number;
  actionIdentifier: string;
  data: unknown;
};

export type DraftNudgeResponseListener = (response: DraftNudgeResponse) => void;

export type DraftNudgeEligibility =
  | { status: 'unknown' }
  | { status: 'has-unknowns' }
  | { status: 'none' };

export type DraftNudgeServiceState =
  | {
      status: 'checking';
      eligibility: DraftNudgeEligibility;
      operation: 'startup' | 'ledger-change' | 'foreground' | 'retry' | 'permission';
    }
  | {
      status: 'idle';
      eligibility: { status: 'none' };
      reason: 'no-unknowns';
    }
  | {
      status: 'permission-required';
      eligibility: { status: 'has-unknowns' };
      permission: Extract<DraftNudgePermission, { status: 'requestable' }>;
    }
  | {
      status: 'denied';
      eligibility: { status: 'has-unknowns' };
      permission: Extract<DraftNudgePermission, { status: 'denied' }>;
    }
  | {
      status: 'enabled';
      eligibility: { status: 'has-unknowns' };
      permission: Extract<DraftNudgePermission, { status: 'allowed' }>;
    }
  | {
      status: 'unavailable';
      eligibility: DraftNudgeEligibility;
      operation: 'permission' | 'notifications';
      message: string;
    }
  | {
      status: 'error';
      eligibility: DraftNudgeEligibility;
      operation: 'ledger' | 'permission' | 'notifications';
      message: string;
    };

export type DraftNudgeAdapter = {
  inspectPermission: () => Promise<DraftNudgePermission>;
  requestPermission: () => Promise<DraftNudgePermission>;
  listScheduled: () => Promise<DraftNudgeScheduledRequest[]>;
  scheduleDailyNudge: (schedule: DraftNudgeSchedule) => Promise<string>;
  cancelScheduled: (identifier: string) => Promise<void>;
  subscribeToResponses: (listener: DraftNudgeResponseListener) => () => void;
  readLastResponse: () => DraftNudgeResponse | null;
  clearLastResponse: () => void;
  dismissOwnedDelivered: () => Promise<void>;
  configureForegroundPresentation: () => void;
};
