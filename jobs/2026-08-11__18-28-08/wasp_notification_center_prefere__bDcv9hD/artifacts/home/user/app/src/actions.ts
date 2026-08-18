import { HttpError } from "wasp/server"
import {
  type BatchUpdateNotificationStatus,
  type UpdateNotificationPreferences,
  type TriggerNotificationEvent,
} from "wasp/server/operations"
import { getIO } from "./webSocket"

export const batchUpdateNotificationStatus: BatchUpdateNotificationStatus<
  { ids: number[]; isRead: boolean },
  { count: number }
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "User is not authenticated");
  }

  const result = await context.entities.Notification.updateMany({
    where: {
      id: {
        in: args.ids,
      },
      userId: context.user.id,
    },
    data: {
      isRead: args.isRead,
    },
  });

  return { count: result.count };
};

export const updateNotificationPreferences: UpdateNotificationPreferences<
  { systemEnabled: boolean; securityEnabled: boolean; activityEnabled: boolean },
  any
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "User is not authenticated");
  }

  const preference = await context.entities.NotificationPreference.upsert({
    where: {
      userId: context.user.id,
    },
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

  return preference;
};

export const triggerNotificationEvent: TriggerNotificationEvent<
  { type: "SYSTEM" | "SECURITY" | "ACTIVITY"; title: string; message: string },
  { success: boolean; created: boolean }
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "User is not authenticated");
  }

  let preference = await context.entities.NotificationPreference.findUnique({
    where: {
      userId: context.user.id,
    },
  });

  if (!preference) {
    preference = await context.entities.NotificationPreference.create({
      data: {
        userId: context.user.id,
        systemEnabled: true,
        securityEnabled: true,
        activityEnabled: true,
      },
    });
  }

  let isEnabled = false;
  if (args.type === "SYSTEM") {
    isEnabled = preference.systemEnabled;
  } else if (args.type === "SECURITY") {
    isEnabled = preference.securityEnabled;
  } else if (args.type === "ACTIVITY") {
    isEnabled = preference.activityEnabled;
  }

  if (isEnabled) {
    const newNotification = await context.entities.Notification.create({
      data: {
        userId: context.user.id,
        type: args.type,
        title: args.title,
        message: args.message,
        isRead: false,
      },
    });

    const io = getIO();
    if (io) {
      io.to(`user-${context.user.id}`).emit("notification", newNotification);
    }

    return { success: true, created: true };
  }

  return { success: true, created: false };
};
