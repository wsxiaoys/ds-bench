import { HttpError } from "wasp/server";
import { getIoInstance } from "./webSocket.js";

export const batchUpdateNotificationStatus = async (
  args: { ids: number[]; isRead: boolean },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Not authenticated");
  }

  const result = await context.entities.Notification.updateMany({
    where: {
      id: { in: args.ids },
      userId: context.user.id,
    },
    data: {
      isRead: args.isRead,
    },
  });

  return result.count;
};

export const updateNotificationPreferences = async (
  args: { systemEnabled: boolean; securityEnabled: boolean; activityEnabled: boolean },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Not authenticated");
  }

  const updated = await context.entities.NotificationPreference.upsert({
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

  return updated;
};

export const triggerNotificationEvent = async (
  args: { type: "SYSTEM" | "SECURITY" | "ACTIVITY"; title: string; message: string },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Not authenticated");
  }

  let preference = await context.entities.NotificationPreference.findUnique({
    where: { userId: context.user.id },
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

    const io = getIoInstance();
    if (io) {
      io.to(`user-${context.user.id}`).emit("notification", newNotification);
    }

    return { success: true, created: true };
  } else {
    return { success: true, created: false };
  }
};
