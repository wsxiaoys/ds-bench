import { type FulfillOrder } from "wasp/server/operations";
import { HttpError, prisma } from "wasp/server";

export const fulfillOrder: FulfillOrder<{ orderId: number }, void> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Not authorized");
  }

  const { orderId } = args;

  try {
    await prisma.$transaction(async (tx) => {
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
        throw new HttpError(404, `Order with ID ${orderId} not found`);
      }

      if (order.status === "FULFILLED") {
        throw new HttpError(400, "Order is already fulfilled");
      }

      // 2. Check stock levels
      for (const item of order.orderItems) {
        if (item.product.stock < item.quantity) {
          throw new HttpError(
            400,
            `Insufficient stock for product ${item.product.name} (SKU: ${item.product.sku}). Requested: ${item.quantity}, Available: ${item.product.stock}`
          );
        }
      }

      // 3 & 4. Process each item
      for (const item of order.orderItems) {
        const newStock = item.product.stock - item.quantity;

        // Decrement stock
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: newStock },
        });

        // Check if stock fell strictly below threshold
        if (newStock < item.product.lowStockThreshold) {
          // Create an Alert
          const alertMessage = `Low stock alert for ${item.product.name} (SKU: ${item.product.sku}). Current stock: ${newStock}.`;
          await tx.alert.create({
            data: {
              productId: item.productId,
              message: alertMessage,
            },
          });

          // Check for existing SENT PurchaseOrder
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

      // 5. Mark order as FULFILLED
      await tx.order.update({
        where: { id: orderId },
        data: { status: "FULFILLED" },
      });
    });
  } catch (error: any) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(500, error.message || "An unexpected error occurred during fulfillment");
  }
};
