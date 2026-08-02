import type { GetNotifications, BatchUpdateNotificationStatus, GetNotificationPreferences, UpdateNotificationPreferences, TriggerNotificationEvent } from "wasp/server/operations";
import type { Notification, NotificationPreference } from "wasp/entities";
import { HttpError } from "wasp/server";
import { getIO } from "./webSocket.js";

export const getNotifications: GetNotifications<void, Notification[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  return context.entities.Notification.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: "desc" },
  });
};

export const batchUpdateNotificationStatus: BatchUpdateNotificationStatus<{ ids: number[]; isRead: boolean }, { count: number }> = async (args, context) => {
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

export const getNotificationPreferences: GetNotificationPreferences<void, NotificationPreference> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  let prefs = await context.entities.NotificationPreference.findUnique({
    where: { userId: context.user.id },
  });

  if (!prefs) {
    prefs = await context.entities.NotificationPreference.create({
      data: {
        userId: context.user.id,
        systemEnabled: true,
        securityEnabled: true,
        activityEnabled: true,
      },
    });
  }

  return prefs;
};

export const updateNotificationPreferences: UpdateNotificationPreferences<{ systemEnabled: boolean; securityEnabled: boolean; activityEnabled: boolean }, NotificationPreference> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  const prefs = await context.entities.NotificationPreference.upsert({
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
  return prefs;
};

export const triggerNotificationEvent: TriggerNotificationEvent<{ type: "SYSTEM" | "SECURITY" | "ACTIVITY"; title: string; message: string }, { success: boolean; created: boolean }> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  const prefs = await context.entities.NotificationPreference.findUnique({
    where: { userId: context.user.id },
  });

  let enabled = true;
  if (prefs) {
    if (args.type === "SYSTEM" && !prefs.systemEnabled) enabled = false;
    if (args.type === "SECURITY" && !prefs.securityEnabled) enabled = false;
    if (args.type === "ACTIVITY" && !prefs.activityEnabled) enabled = false;
  }

  if (!enabled) {
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

  const io = getIO();
  if (io) {
    io.to(`user-${context.user.id}`).emit("notification", notification);
  }

  return { success: true, created: true };
};
