export const getNotifications = async (args: any, context: any) => {
  if (!context.user) {
    throw new Error("Not authorized");
  }
  return context.entities.Notification.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: "desc" },
  });
};

export const getNotificationPreferences = async (args: any, context: any) => {
  if (!context.user) {
    throw new Error("Not authorized");
  }
  const preference = await context.entities.NotificationPreference.findUnique({
    where: { userId: context.user.id },
  });
  if (preference) {
    return preference;
  }
  // Automatically create one if it doesn't exist yet
  return context.entities.NotificationPreference.create({
    data: {
      userId: context.user.id,
      systemEnabled: true,
      securityEnabled: true,
      activityEnabled: true,
    },
  });
};
