import type { FulfillOrder } from "wasp/server/operations";
import { HttpError } from "wasp/server";
import { prisma } from "wasp/server";

export const fulfillOrder: FulfillOrder<{ orderId: number }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const { orderId } = args;

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch the order with its items
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
      throw new HttpError(404, `Order with ID ${orderId} not found.`);
    }

    if (order.status === "FULFILLED") {
      throw new HttpError(400, `Order ${orderId} is already fulfilled.`);
    }

    // 2. Check stock for each item in the order
    for (const item of order.orderItems) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new HttpError(404, `Product ${item.product.name} not found.`);
      }

      if (product.stock < item.quantity) {
        throw new HttpError(
          400,
          `Insufficient stock for ${product.name} (SKU: ${product.sku}). Requested: ${item.quantity}, Available: ${product.stock}.`
        );
      }
    }

    // 3. Decrement stock, check lowStockThreshold, trigger alerts/PO
    for (const item of order.orderItems) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new HttpError(404, `Product ${item.product.name} not found.`);
      }

      const newStock = product.stock - item.quantity;

      // Update product stock
      await tx.product.update({
        where: { id: product.id },
        data: { stock: newStock },
      });

      // 4. Check low stock threshold
      if (newStock < product.lowStockThreshold) {
        // Create an Alert record
        const alertMessage = `Low stock alert for ${product.name} (SKU: ${product.sku}). Current stock: ${newStock}.`;
        await tx.alert.create({
          data: {
            productId: product.id,
            message: alertMessage,
          },
        });

        // Check if there is already an existing PurchaseOrder for this product with status "SENT"
        const existingPO = await tx.purchaseOrder.findFirst({
          where: {
            productId: product.id,
            status: "SENT",
          },
        });

        if (!existingPO) {
          await tx.purchaseOrder.create({
            data: {
              supplierId: product.supplierId,
              productId: product.id,
              quantity: product.reorderQuantity,
              status: "SENT",
            },
          });
        }
      }
    }

    // 5. Set order status to "FULFILLED"
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: { status: "FULFILLED" },
    });

    return updatedOrder;
  });
};
