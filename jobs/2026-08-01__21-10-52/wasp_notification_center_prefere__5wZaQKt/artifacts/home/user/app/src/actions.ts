import {
  type BatchUpdateNotificationStatus,
  type UpdateNotificationPreferences,
  type TriggerNotificationEvent,
} from "wasp/server/operations";
import { type Notification, type NotificationPreference } from "wasp/entities";
import { HttpError } from "wasp/server";
import { getIoInstance } from "./webSocket";

export const batchUpdateNotificationStatus: BatchUpdateNotificationStatus<
  { ids: number[]; isRead: boolean },
  { count: number }
> = async ({ ids, isRead }, context) => {
  if (!context.user) {
    throw new HttpError(401, "Not authenticated");
  }
  return context.entities.Notification.updateMany({
    where: {
      id: { in: ids },
      userId: context.user.id,
    },
    data: {
      isRead,
    },
  });
};

export const updateNotificationPreferences: UpdateNotificationPreferences<
  { systemEnabled: boolean; securityEnabled: boolean; activityEnabled: boolean },
  NotificationPreference
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Not authenticated");
  }
  return context.entities.NotificationPreference.upsert({
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

export const triggerNotificationEvent: TriggerNotificationEvent<
  { type: "SYSTEM" | "SECURITY" | "ACTIVITY"; title: string; message: string },
  { success: boolean; created: boolean }
> = async ({ type, title, message }, context) => {
  if (!context.user) {
    throw new HttpError(401, "Not authenticated");
  }

  // Get or create preferences
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

  // Check if the preference for the given type is enabled
  let isEnabled = false;
  if (type === "SYSTEM") {
    isEnabled = preference.systemEnabled;
  } else if (type === "SECURITY") {
    isEnabled = preference.securityEnabled;
  } else if (type === "ACTIVITY") {
    isEnabled = preference.activityEnabled;
  }

  if (isEnabled) {
    const newNotification = await context.entities.Notification.create({
      data: {
        userId: context.user.id,
        type,
        title,
        message,
        isRead: false,
      },
    });

    // Emit real-time 'notification' event to the user's Socket.IO room (e.g., user-${userId})
    const io = getIoInstance();
    if (io) {
      const roomName = `user-${context.user.id}`;
      io.to(roomName).emit("notification", newNotification);
      console.log(`Emitted notification to room ${roomName}`);
    } else {
      console.log("WebSocket io instance is not initialized yet");
    }

    return { success: true, created: true };
  }

  return { success: true, created: false };
};
