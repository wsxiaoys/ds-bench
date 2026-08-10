export const getAlerts = async (args: any, context: any) => {
  if (!context.user) {
    throw new Error("Unauthorized");
  }
  return context.entities.Alert.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
};
