import { HttpError } from "wasp/server";
import {
  type BatchUpdateNotificationStatus,
  type UpdateNotificationPreferences,
  type TriggerNotificationEvent,
} from "wasp/server/operations";
import { type NotificationPreference } from "wasp/entities";
import { getIo } from "./webSocket";

type NotificationType = "SYSTEM" | "SECURITY" | "ACTIVITY";

export const batchUpdateNotificationStatus: BatchUpdateNotificationStatus<
  { ids: number[]; isRead: boolean },
  { count: number }
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const result = await context.entities.Notification.updateMany({
    where: {
      id: { in: args.ids },
      userId: context.user.id,
    },
    data: { isRead: args.isRead },
  });

  return { count: result.count };
};

export const updateNotificationPreferences: UpdateNotificationPreferences<
  { systemEnabled: boolean; securityEnabled: boolean; activityEnabled: boolean },
  NotificationPreference
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return context.entities.NotificationPreference.upsert({
    where: { userId: context.user.id },
    update: {
      systemEnabled: args.systemEnabled,
      securityEnabled: args.securityEnabled,
      activityEnabled: args.activityEnabled,
    },
    create: {
      userId: context.user.id,
      systemEnabled: args.systemEnabled,
      securityEnabled: args.securityEnabled,
      activityEnabled: args.activityEnabled,
    },
  });
};

export const triggerNotificationEvent: TriggerNotificationEvent<
  { type: NotificationType; title: string; message: string },
  { success: true; created: boolean }
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const preference = await context.entities.NotificationPreference.findUnique({
    where: { userId: context.user.id },
  });

  const isEnabledForType = (() => {
    if (!preference) {
      // No preference record yet: default to enabled (matches the
      // default `true` values used when a preference record is created).
      return true;
    }
    switch (args.type) {
      case "SYSTEM":
        return preference.systemEnabled;
      case "SECURITY":
        return preference.securityEnabled;
      case "ACTIVITY":
        return preference.activityEnabled;
      default:
        return false;
    }
  })();

  if (!isEnabledForType) {
    return { success: true, created: false };
  }

  const notification = await context.entities.Notification.create({
    data: {
      userId: context.user.id,
      type: args.type,
      title: args.title,
      message: args.message,
    },
  });

  const io = getIo();
  if (io) {
    io.to(`user-${context.user.id}`).emit("notification", notification);
  }

  return { success: true, created: true };
};
