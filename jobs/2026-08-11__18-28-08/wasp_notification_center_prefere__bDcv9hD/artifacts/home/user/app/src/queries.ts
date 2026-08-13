import { HttpError } from "wasp/server"
import { type GetNotifications, type GetNotificationPreferences } from "wasp/server/operations"

export const getNotifications: GetNotifications<void, any[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "User is not authenticated");
  }

  return context.entities.Notification.findMany({
    where: {
      userId: context.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const getNotificationPreferences: GetNotificationPreferences<void, any> = async (args, context) => {
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

  return preference;
};
