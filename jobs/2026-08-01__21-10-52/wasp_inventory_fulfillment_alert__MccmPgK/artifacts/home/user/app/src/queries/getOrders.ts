export const getOrders = async (args: any, context: any) => {
  if (!context.user) {
    throw new Error("Unauthorized");
  }
  return context.entities.Order.findMany({
    include: {
      orderItems: {
        include: {
          product: true,
        },
      },
    },
  });
};
