import type { GetProducts, GetOrders, GetAlerts, GetPurchaseOrders } from "wasp/server/operations";
import { HttpError } from "wasp/server";

export const getProducts: GetProducts<void, any[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  return context.entities.Product.findMany({
    include: {
      supplier: true,
    },
    orderBy: {
      id: "asc",
    },
  });
};

export const getOrders: GetOrders<void, any[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  return context.entities.Order.findMany({
    include: {
      orderItems: {
        include: {
          product: true,
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  });
};

export const getAlerts: GetAlerts<void, any[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  return context.entities.Alert.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const getPurchaseOrders: GetPurchaseOrders<void, any[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
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
