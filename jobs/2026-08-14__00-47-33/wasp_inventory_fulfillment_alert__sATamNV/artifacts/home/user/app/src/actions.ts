import { prisma } from "wasp/server";
import { type FulfillOrder } from "wasp/server/operations";

export const fulfillOrder: FulfillOrder<{ orderId: number }, void> = async (args, context) => {
  if (!context.user) throw new Error("Not authorized");
  
  const { orderId } = args;

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status === "FULFILLED") {
      throw new Error("Order already fulfilled");
    }

    // Check stock first
    for (const item of order.orderItems) {
      if (item.product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.product.name} (SKU: ${item.product.sku})`);
      }
    }

    // Process each item
    for (const item of order.orderItems) {
      const newStock = item.product.stock - item.quantity;

      // Update product stock
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: newStock },
      });

      // Check if stock is strictly less than lowStockThreshold
      if (newStock < item.product.lowStockThreshold) {
        // Create Alert
        const alertMessage = `Low stock alert for ${item.product.name} (SKU: ${item.product.sku}). Current stock: ${newStock}.`;
        await tx.alert.create({
          data: {
            productId: item.productId,
            message: alertMessage,
          },
        });

        // Check for existing PO with status SENT
        const existingPO = await tx.purchaseOrder.findFirst({
          where: {
            productId: item.productId,
            status: "SENT",
          },
        });

        if (!existingPO) {
          await tx.purchaseOrder.create({
            data: {
              supplierId: item.product.supplierId,
              productId: item.productId,
              quantity: item.product.reorderQuantity,
              status: "SENT",
            },
          });
        }
      }
    }

    // Set order status to FULFILLED
    await tx.order.update({
      where: { id: orderId },
      data: { status: "FULFILLED" },
    });
  });
};
