/**
 * Native Expo Notifications adapter for local unknown-draft reminders.
 *
 * This is the only application module that imports the native notification
 * package. It translates native permission and request shapes into the
 * platform-neutral contracts so scheduling policy remains testable on Linux.
 */
import * as Notifications from 'expo-notifications';

import {
  isOwnedDraftNudgeData,
} from './draft-nudge-policy';
import type {
  DraftNudgeAdapter,
  DraftNudgeNotificationSound,
  DraftNudgePermission,
  DraftNudgeResponse,
  DraftNudgeSchedule,
  DraftNudgeScheduledRequest,
  DraftNudgeScheduledTrigger,
} from './draft-nudge-contract';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function mapPermission(
  response: Notifications.NotificationPermissionsStatus
): DraftNudgePermission {
  const iosStatus = response.ios?.status;
  if (iosStatus !== undefined) {
    if (iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED) {
      return {
        status: 'allowed',
        quiet: response.ios?.allowsAlert === false,
      };
    }
    if (iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return { status: 'allowed', quiet: true };
    }
    if (iosStatus === Notifications.IosAuthorizationStatus.NOT_DETERMINED) {
      return { status: 'requestable', canAskAgain: response.canAskAgain };
    }
    if (iosStatus === Notifications.IosAuthorizationStatus.DENIED) {
      return { status: 'denied', canAskAgain: response.canAskAgain };
    }
    return {
      status: 'unavailable',
      message: `Notification permission returned unsupported iOS status ${String(iosStatus)}.`,
    };
  }

  if (response.status === 'granted' && response.granted) {
    return { status: 'allowed', quiet: false };
  }
  if (response.status === 'undetermined') {
    return { status: 'requestable', canAskAgain: response.canAskAgain };
  }
  if (response.status === 'denied') {
    return { status: 'denied', canAskAgain: response.canAskAgain };
  }
  return {
    status: 'unavailable',
    message: `Notification permission returned unsupported status ${String(response.status)}.`,
  };
}

function mapSound(sound: Notifications.NotificationContent['sound']): DraftNudgeNotificationSound {
  if (sound === null) return 'none';
  return sound === 'default' ? 'default' : 'custom';
}

function mapTrigger(
  trigger: Notifications.NotificationTrigger
): DraftNudgeScheduledTrigger {
  if (trigger === null || typeof trigger !== 'object') {
    return { kind: 'other', nativeType: 'immediate', repeats: false };
  }

  const rawTrigger = trigger as Record<string, unknown>;
  const nativeType = rawTrigger.type;
  if (
    nativeType === 'daily' &&
    typeof rawTrigger.hour === 'number' &&
    typeof rawTrigger.minute === 'number'
  ) {
    return {
      kind: 'daily',
      repeats: true,
      hour: rawTrigger.hour,
      minute: rawTrigger.minute,
    };
  }

  if (nativeType === 'calendar' && isRecord(rawTrigger.dateComponents)) {
    const components = rawTrigger.dateComponents;
    const hour = components.hour;
    const minute = components.minute;
    const hasOnlyDailyComponents =
      components.year === undefined &&
      components.month === undefined &&
      components.day === undefined &&
      components.weekday === undefined &&
      components.weekOfMonth === undefined &&
      components.weekOfYear === undefined &&
      components.weekdayOrdinal === undefined &&
      components.quarter === undefined &&
      components.era === undefined &&
      components.yearForWeekOfYear === undefined &&
      components.nanosecond === undefined &&
      (components.second === undefined || components.second === 0) &&
      typeof hour === 'number' &&
      typeof minute === 'number';

    if (hasOnlyDailyComponents) {
      return {
        kind: 'daily',
        repeats: rawTrigger.repeats === true,
        hour,
        minute,
      };
    }
  }

  return {
    kind: 'other',
    nativeType: typeof nativeType === 'string' ? nativeType : 'unknown',
    repeats: typeof rawTrigger.repeats === 'boolean'
      ? rawTrigger.repeats
      : false,
  };
}

function mapScheduledRequest(
  request: Notifications.NotificationRequest
): DraftNudgeScheduledRequest {
  return {
    identifier: request.identifier,
    content: {
      title: request.content.title,
      body: request.content.body,
      data: request.content.data,
      sound: mapSound(request.content.sound),
      badge: request.content.badge ?? null,
    },
    trigger: mapTrigger(request.trigger),
  };
}

function mapResponse(response: Notifications.NotificationResponse): DraftNudgeResponse {
  return {
    requestIdentifier: response.notification.request.identifier,
    deliveredAt: response.notification.date,
    actionIdentifier: response.actionIdentifier,
    data: response.notification.request.content.data,
  };
}

export const notificationAdapter: DraftNudgeAdapter = {
  async inspectPermission() {
    return mapPermission(await Notifications.getPermissionsAsync());
  },

  async requestPermission() {
    const current = await notificationAdapter.inspectPermission();
    if (current.status !== 'requestable' || !current.canAskAgain) {
      return current;
    }
    return mapPermission(
      await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowSound: false,
          allowBadge: false,
        },
      })
    );
  },

  async listScheduled() {
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    return requests.map(mapScheduledRequest);
  },

  scheduleDailyNudge(schedule: DraftNudgeSchedule) {
    return Notifications.scheduleNotificationAsync({
      identifier: schedule.identifier,
      content: {
        title: schedule.title,
        body: schedule.body,
        data: schedule.data,
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: schedule.trigger.hour,
        minute: schedule.trigger.minute,
      },
    });
  },

  cancelScheduled(identifier: string) {
    return Notifications.cancelScheduledNotificationAsync(identifier);
  },

  subscribeToResponses(listener) {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        listener(mapResponse(response));
      } catch (error: unknown) {
        console.error('Unknown-draft notification response listener failed', error);
      }
    });
    return () => subscription.remove();
  },

  readLastResponse() {
    const response = Notifications.getLastNotificationResponse();
    return response === null ? null : mapResponse(response);
  },

  clearLastResponse() {
    Notifications.clearLastNotificationResponse();
  },

  async dismissOwnedDelivered() {
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const notification of presented) {
      const identifier = notification.request.identifier;
      if (!isOwnedDraftNudgeData(identifier, notification.request.content.data)) {
        continue;
      }
      await Notifications.dismissNotificationAsync(identifier);
    }
  },

  configureForegroundPresentation() {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const owned = isOwnedDraftNudgeData(
          notification.request.identifier,
          notification.request.content.data
        );
        return {
          shouldShowBanner: !owned,
          shouldShowList: !owned,
          shouldPlaySound: !owned,
          shouldSetBadge: !owned,
        };
      },
    });
  },
};

export { mapPermission, mapResponse, mapScheduledRequest, mapTrigger };
