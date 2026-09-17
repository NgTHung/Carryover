import type { DraftNudgePermission } from '../src/notifications/draft-nudge-contract';
import {
  DRAFT_NUDGE_BODY,
  DRAFT_NUDGE_IDENTIFIER,
  DRAFT_NUDGE_PAYLOAD,
  DRAFT_NUDGE_SCHEDULE,
  DRAFT_NUDGE_TITLE,
} from '../src/notifications/draft-nudge-policy';

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockGetScheduled = jest.fn();
const mockSchedule = jest.fn();
const mockCancel = jest.fn();
const mockAddResponseListener = jest.fn();
const mockGetLastResponse = jest.fn();
const mockClearLastResponse = jest.fn();
const mockGetPresented = jest.fn();
const mockDismiss = jest.fn();
const mockSetHandler = jest.fn();

jest.mock('expo-notifications', () => ({
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  IosAlertStyle: { NONE: 0 },
  SchedulableTriggerInputTypes: { DAILY: 'daily', CALENDAR: 'calendar' },
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissions(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissions(...args),
  getAllScheduledNotificationsAsync: (...args: unknown[]) => mockGetScheduled(...args),
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancel(...args),
  addNotificationResponseReceivedListener: (...args: unknown[]) => mockAddResponseListener(...args),
  getLastNotificationResponse: (...args: unknown[]) => mockGetLastResponse(...args),
  clearLastNotificationResponse: (...args: unknown[]) => mockClearLastResponse(...args),
  getPresentedNotificationsAsync: (...args: unknown[]) => mockGetPresented(...args),
  dismissNotificationAsync: (...args: unknown[]) => mockDismiss(...args),
  setNotificationHandler: (...args: unknown[]) => mockSetHandler(...args),
}));

import * as Notifications from 'expo-notifications';
import {
  mapPermission,
  mapResponse,
  mapScheduledRequest,
  mapTrigger,
  notificationAdapter,
} from '../src/notifications/notification-adapter';

function nativePermission(
  overrides: Partial<Notifications.NotificationPermissionsStatus> = {}
): Notifications.NotificationPermissionsStatus {
  return {
    status: 'undetermined' as Notifications.NotificationPermissionsStatus['status'],
    expires: 'never',
    granted: false,
    canAskAgain: true,
    ...overrides,
  };
}

function iosPermission(
  status: number,
  overrides: Partial<Notifications.NotificationPermissionsStatus> = {}
): Notifications.NotificationPermissionsStatus {
  return nativePermission({
    ...overrides,
    ios: {
      status,
      allowsDisplayInNotificationCenter: true,
      allowsDisplayOnLockScreen: true,
      allowsDisplayInCarPlay: true,
      allowsAlert: true,
      allowsBadge: false,
      allowsSound: false,
      allowsCriticalAlerts: false,
      alertStyle: Notifications.IosAlertStyle.NONE,
      allowsPreviews: null,
      providesAppNotificationSettings: false,
      allowsAnnouncements: false,
    },
  });
}

const schedule = DRAFT_NUDGE_SCHEDULE;

beforeEach(() => {
  jest.resetAllMocks();
  mockGetPermissions.mockResolvedValue(iosPermission(0));
  mockRequestPermissions.mockResolvedValue(iosPermission(2, { granted: true }));
  mockGetScheduled.mockResolvedValue([]);
  mockSchedule.mockResolvedValue(DRAFT_NUDGE_IDENTIFIER);
  mockCancel.mockResolvedValue(undefined);
  mockAddResponseListener.mockReturnValue({ remove: jest.fn() });
  mockGetLastResponse.mockReturnValue(null);
  mockGetPresented.mockResolvedValue([]);
  mockDismiss.mockResolvedValue(undefined);
});

test.each([
  [iosPermission(2, { granted: true }), { status: 'allowed', quiet: false }],
  [iosPermission(3, { granted: false }), { status: 'allowed', quiet: true }],
  [iosPermission(0), { status: 'requestable', canAskAgain: true }],
  [iosPermission(1, { canAskAgain: false }), { status: 'denied', canAskAgain: false }],
] as const)('maps iOS permission %s into a narrow state', (response, expected) => {
  expect(mapPermission(response)).toEqual(expected satisfies DraftNudgePermission);
});

test('fails closed for ephemeral and unrecognized permission states', () => {
  expect(mapPermission(iosPermission(4))).toEqual({
    status: 'unavailable',
    message: expect.stringContaining('unsupported iOS status'),
  });
  expect(mapPermission(nativePermission({
    status: 'other' as unknown as Notifications.NotificationPermissionsStatus['status'],
  }))).toEqual({
    status: 'unavailable',
    message: expect.stringContaining('unsupported status'),
  });
});

test('rechecks permission before requesting alert access without sound or badge access', async () => {
  mockGetPermissions
    .mockResolvedValueOnce(iosPermission(0))
    .mockResolvedValueOnce(iosPermission(0));

  await expect(notificationAdapter.requestPermission()).resolves.toEqual({
    status: 'allowed',
    quiet: false,
  });
  expect(mockGetPermissions).toHaveBeenCalledTimes(1);
  expect(mockRequestPermissions).toHaveBeenCalledWith({
    ios: {
      allowAlert: true,
      allowSound: false,
      allowBadge: false,
    },
  });
});

test('does not prompt when canAskAgain is false', async () => {
  mockGetPermissions.mockResolvedValue(iosPermission(0, { canAskAgain: false }));

  await expect(notificationAdapter.requestPermission()).resolves.toEqual({
    status: 'requestable',
    canAskAgain: false,
  });
  expect(mockRequestPermissions).not.toHaveBeenCalled();
});

test('schedules one stable daily local request with silent content', async () => {
  await expect(notificationAdapter.scheduleDailyNudge(schedule)).resolves.toBe(DRAFT_NUDGE_IDENTIFIER);

  expect(mockSchedule).toHaveBeenCalledWith({
    identifier: DRAFT_NUDGE_IDENTIFIER,
    content: {
      title: DRAFT_NUDGE_TITLE,
      body: DRAFT_NUDGE_BODY,
      data: DRAFT_NUDGE_PAYLOAD,
      sound: false,
    },
    trigger: {
      type: 'daily',
      hour: 20,
      minute: 0,
    },
  });
});

test('normalizes native daily and iOS calendar representations to the same trigger', () => {
  expect(mapTrigger({
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: 20,
    minute: 0,
  } as unknown as Notifications.NotificationTrigger)).toEqual({
    kind: 'daily',
    repeats: true,
    hour: 20,
    minute: 0,
  });
  expect(mapTrigger({
    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    repeats: true,
    dateComponents: {
      hour: 20,
      minute: 0,
      second: 0,
      isLeapMonth: false,
      isRepeatedDay: false,
    },
  } as unknown as Notifications.NotificationTrigger)).toEqual({
    kind: 'daily',
    repeats: true,
    hour: 20,
    minute: 0,
  });
  expect(mapTrigger({ type: Notifications.SchedulableTriggerInputTypes.CALENDAR, repeats: true, dateComponents: {
    day: 17,
    hour: 20,
    minute: 0,
    isLeapMonth: false,
    isRepeatedDay: false,
  } } as unknown as Notifications.NotificationTrigger)).toEqual({ kind: 'other', nativeType: 'calendar', repeats: true });
});

test('normalizes request content and preserves unrelated scheduled shapes', async () => {
  mockGetScheduled.mockResolvedValue([
    {
      identifier: DRAFT_NUDGE_IDENTIFIER,
      content: {
        title: DRAFT_NUDGE_TITLE,
        body: DRAFT_NUDGE_BODY,
        data: DRAFT_NUDGE_PAYLOAD,
        sound: null,
        badge: null,
      },
      trigger: {
        type: 'calendar',
        repeats: true,
        dateComponents: {
          hour: 20,
          minute: 0,
          isLeapMonth: false,
          isRepeatedDay: false,
        },
      },
    },
  ]);

  await expect(notificationAdapter.listScheduled()).resolves.toEqual([{
    identifier: DRAFT_NUDGE_IDENTIFIER,
    content: {
      title: DRAFT_NUDGE_TITLE,
      body: DRAFT_NUDGE_BODY,
      data: DRAFT_NUDGE_PAYLOAD,
      sound: 'none',
      badge: null,
    },
    trigger: { kind: 'daily', repeats: true, hour: 20, minute: 0 },
  }]);
  expect(mapScheduledRequest).toBeDefined();
});

test('normalizes the silent boolean form into no sound', () => {
  const request = {
    identifier: DRAFT_NUDGE_IDENTIFIER,
    content: {
      title: DRAFT_NUDGE_TITLE,
      body: DRAFT_NUDGE_BODY,
      data: DRAFT_NUDGE_PAYLOAD,
      sound: false,
      badge: null,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      repeats: true,
      dateComponents: {
        hour: 20,
        minute: 0,
        isLeapMonth: false,
        isRepeatedDay: false,
      },
    },
  } as unknown as Notifications.NotificationRequest;

  expect(mapScheduledRequest(request).content.sound).toBe('none');
});

test('cancels only the requested native identifier and propagates failures', async () => {
  await notificationAdapter.cancelScheduled('owned-duplicate');
  expect(mockCancel).toHaveBeenCalledWith('owned-duplicate');

  mockCancel.mockRejectedValueOnce(new Error('cancel failed'));
  await expect(notificationAdapter.cancelScheduled('owned-duplicate')).rejects.toThrow('cancel failed');
});

test('maps response delivery identity data and clears the retained response explicitly', () => {
  const response = {
    notification: {
      date: 1_757_000_000_000,
      request: {
        identifier: DRAFT_NUDGE_IDENTIFIER,
        content: { data: DRAFT_NUDGE_PAYLOAD },
      },
    },
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
  } as unknown as Notifications.NotificationResponse;
  mockGetLastResponse.mockReturnValue(response);

  expect(notificationAdapter.readLastResponse()).toEqual({
    requestIdentifier: DRAFT_NUDGE_IDENTIFIER,
    deliveredAt: 1_757_000_000_000,
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    data: DRAFT_NUDGE_PAYLOAD,
  });
  notificationAdapter.clearLastResponse();
  expect(mockClearLastResponse).toHaveBeenCalledTimes(1);
  expect(mapResponse(response)).toEqual(notificationAdapter.readLastResponse());
});

test('cleans up only owned delivered reminders and suppresses owned foreground presentation', async () => {
  mockGetPresented.mockResolvedValue([
    {
      request: {
        identifier: DRAFT_NUDGE_IDENTIFIER,
        content: { data: DRAFT_NUDGE_PAYLOAD },
      },
    },
    {
      request: {
        identifier: 'unrelated',
        content: { data: { kind: 'other' } },
      },
    },
  ]);

  await notificationAdapter.dismissOwnedDelivered();
  expect(mockDismiss).toHaveBeenCalledTimes(1);
  expect(mockDismiss).toHaveBeenCalledWith(DRAFT_NUDGE_IDENTIFIER);

  notificationAdapter.configureForegroundPresentation();
  const handler = mockSetHandler.mock.calls[0]?.[0] as Notifications.NotificationHandler;
  await expect(handler.handleNotification({
    request: {
      identifier: DRAFT_NUDGE_IDENTIFIER,
      content: { data: DRAFT_NUDGE_PAYLOAD },
    },
  } as unknown as Notifications.Notification)).resolves.toEqual({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  });
});

test('maps and subscribes notification responses before delivering them', () => {
  let nativeListener: ((response: Notifications.NotificationResponse) => void) | undefined;
  mockAddResponseListener.mockImplementation((listener: (response: Notifications.NotificationResponse) => void) => {
    nativeListener = listener;
    return { remove: jest.fn() };
  });
  const listener = jest.fn();
  const unsubscribe = notificationAdapter.subscribeToResponses(listener);
  nativeListener?.({
    notification: {
      date: 1,
      request: {
        identifier: DRAFT_NUDGE_IDENTIFIER,
        content: { data: DRAFT_NUDGE_PAYLOAD },
      },
    },
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
  } as unknown as Notifications.NotificationResponse);

  expect(listener).toHaveBeenCalledWith({
    requestIdentifier: DRAFT_NUDGE_IDENTIFIER,
    deliveredAt: 1,
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    data: DRAFT_NUDGE_PAYLOAD,
  });
  expect(typeof unsubscribe).toBe('function');
});
