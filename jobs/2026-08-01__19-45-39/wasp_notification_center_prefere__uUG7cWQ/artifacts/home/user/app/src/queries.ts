import { HttpError } from "wasp/server";
import { type GetNotifications, type GetNotificationPreferences } from "wasp/server/operations";
import { type Notification, type NotificationPreference } from "wasp/entities";

export const getNotifications: GetNotifications<void, Notification[]> = async (
  _args,
  context
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return context.entities.Notification.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: "desc" },
  });
};

export const getNotificationPreferences: GetNotificationPreferences<
  void,
  NotificationPreference
> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const existingPreference = await context.entities.NotificationPreference.findUnique({
    where: { userId: context.user.id },
  });

  if (existingPreference) {
    return existingPreference;
  }

  return context.entities.NotificationPreference.create({
    data: {
      userId: context.user.id,
      systemEnabled: true,
      securityEnabled: true,
      activityEnabled: true,
    },
  });
};
