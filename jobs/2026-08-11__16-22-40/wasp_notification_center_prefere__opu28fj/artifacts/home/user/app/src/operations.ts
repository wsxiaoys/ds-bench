import { HttpError } from "wasp/server";
import { getIoInstance } from "./webSocket";

export const getNotifications = async (args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated.");
  }
  const { Notification } = context.entities;
  return await Notification.findMany({
    where: {
      userId: context.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const batchUpdateNotificationStatus = async (
  args: { ids: number[]; isRead: boolean },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated.");
  }
  const { Notification } = context.entities;
  const result = await Notification.updateMany({
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

export const getNotificationPreferences = async (args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated.");
  }
  const { NotificationPreference } = context.entities;
  let preference = await NotificationPreference.findUnique({
    where: {
      userId: context.user.id,
    },
  });
  if (!preference) {
    preference = await NotificationPreference.create({
      data: {
        userId: context.user.id,
        systemEnabled: true,
        securityEnabled: true,
        activityEnabled: true,
      },
    });
  }
  return preference;
};

export const updateNotificationPreferences = async (
  args: { systemEnabled: boolean; securityEnabled: boolean; activityEnabled: boolean },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated.");
  }
  const { NotificationPreference } = context.entities;
  return await NotificationPreference.upsert({
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
};

export const triggerNotificationEvent = async (
  args: { type: "SYSTEM" | "SECURITY" | "ACTIVITY"; title: string; message: string },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated.");
  }
  const { Notification, NotificationPreference } = context.entities;

  let preference = await NotificationPreference.findUnique({
    where: {
      userId: context.user.id,
    },
  });
  if (!preference) {
    preference = await NotificationPreference.create({
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
    const notification = await Notification.create({
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
      io.to(`user-${context.user.id}`).emit("notification", notification);
      console.log(`Emitted notification event to user-${context.user.id}`);
    } else {
      console.warn("Socket.IO server instance not initialized yet!");
    }

    return { success: true, created: true };
  }

  return { success: true, created: false };
};
