import { HttpError } from "wasp/server";
import { getIoServer } from "./webSocket";

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
  args: { systemEnabled: boolean; securityEnabled: boolean; activityEnabled: boolean },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  const preference = await context.entities.NotificationPreference.upsert({
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
  return preference;
};

export const triggerNotificationEvent = async (
  args: { type: "SYSTEM" | "SECURITY" | "ACTIVITY"; title: string; message: string },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  // 1. Get or create notification preferences
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

  // 2. Check if preference for the given type is enabled
  let isEnabled = false;
  if (args.type === "SYSTEM") {
    isEnabled = preference.systemEnabled;
  } else if (args.type === "SECURITY") {
    isEnabled = preference.securityEnabled;
  } else if (args.type === "ACTIVITY") {
    isEnabled = preference.activityEnabled;
  }

  if (isEnabled) {
    // Create a new notification
    const newNotification = await context.entities.Notification.create({
      data: {
        userId: context.user.id,
        type: args.type,
        title: args.title,
        message: args.message,
        isRead: false,
      },
    });

    // Emit real-time event to the user's Socket.IO room
    const io = getIoServer();
    if (io) {
      console.log(`Emitting notification to room user-${context.user.id}`);
      io.to(`user-${context.user.id}`).emit("notification", newNotification);
    } else {
      console.warn("Socket.IO server instance not initialized yet!");
    }

    return { success: true, created: true };
  }

  return { success: true, created: false };
};
