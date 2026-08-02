export const getProducts = async (_args: void, context: any) => {
  const products = await context.entities.Product.findMany({
    include: {
      supplier: {
        select: {
          name: true,
        },
      },
    },
  });
  return products;
};

export const getOrders = async (_args: void, context: any) => {
  const orders = await context.entities.Order.findMany({
    include: {
      orderItems: {
        include: {
          product: {
            select: {
              sku: true,
              name: true,
            },
          },
        },
      },
    },
  });
  return orders;
};

export const getAlerts = async (_args: void, context: any) => {
  const alerts = await context.entities.Alert.findMany({
    include: {
      product: {
        select: {
          sku: true,
          name: true,
        },
      },
    },
  });
  return alerts;
};

export const getPurchaseOrders = async (_args: void, context: any) => {
  const purchaseOrders = await context.entities.PurchaseOrder.findMany({
    include: {
      supplier: {
        select: {
          name: true,
        },
      },
      product: {
        select: {
          sku: true,
        },
      },
    },
  });
  return purchaseOrders;
};
