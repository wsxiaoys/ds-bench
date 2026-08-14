import { type GetProducts, type GetOrders, type GetAlerts, type GetPurchaseOrders } from "wasp/server/operations";

export const getProducts: GetProducts<void, any> = async (_args, context) => {
  if (!context.user) {
    throw new Error("Not authorized");
  }
  return context.entities.Product.findMany({
    include: {
      supplier: true,
    },
  });
};

export const getOrders: GetOrders<void, any> = async (_args, context) => {
  if (!context.user) {
    throw new Error("Not authorized");
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

export const getAlerts: GetAlerts<void, any> = async (_args, context) => {
  if (!context.user) {
    throw new Error("Not authorized");
  }
  return context.entities.Alert.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const getPurchaseOrders: GetPurchaseOrders<void, any> = async (_args, context) => {
  if (!context.user) {
    throw new Error("Not authorized");
  }
  return context.entities.PurchaseOrder.findMany({
    include: {
      supplier: true,
      product: true,
    },
  });
};
