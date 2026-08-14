import { HttpError } from "wasp/server";
import { getIoInstance } from "./webSocket.js";

export const batchUpdateNotificationStatus = async (
  args: { ids: number[]; isRead: boolean },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
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

  return { count: result.count };
};

export const updateNotificationPreferences = async (
  args: {
    systemEnabled: boolean;
    securityEnabled: boolean;
    activityEnabled: boolean;
  },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const preferences = await context.entities.NotificationPreference.upsert({
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

  return preferences;
};

export const triggerNotificationEvent = async (
  args: {
    type: "SYSTEM" | "SECURITY" | "ACTIVITY";
    title: string;
    message: string;
  },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  let preferences = await context.entities.NotificationPreference.findUnique({
    where: {
      userId: context.user.id,
    },
  });

  if (!preferences) {
    preferences = await context.entities.NotificationPreference.create({
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
    isEnabled = preferences.systemEnabled;
  } else if (args.type === "SECURITY") {
    isEnabled = preferences.securityEnabled;
  } else if (args.type === "ACTIVITY") {
    isEnabled = preferences.activityEnabled;
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
      const roomName = `user-${context.user.id}`;
      io.to(roomName).emit("notification", newNotification);
      console.log(`Emitted notification to room ${roomName}`);
    }

    return { success: true, created: true };
  }

  return { success: true, created: false };
};
