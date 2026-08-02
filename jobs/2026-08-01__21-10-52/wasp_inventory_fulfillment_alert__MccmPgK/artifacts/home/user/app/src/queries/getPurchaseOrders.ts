export const getPurchaseOrders = async (args: any, context: any) => {
  if (!context.user) {
    throw new Error("Unauthorized");
  }
  return context.entities.PurchaseOrder.findMany({
    include: {
      supplier: true,
      product: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};
