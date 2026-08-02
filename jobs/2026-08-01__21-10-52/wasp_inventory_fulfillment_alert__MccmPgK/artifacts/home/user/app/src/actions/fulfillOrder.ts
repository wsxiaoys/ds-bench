import { HttpError } from "wasp/server";
import { prisma } from "wasp/server";

export const fulfillOrder = async (args: { orderId: number }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const { orderId } = args;
  if (orderId === undefined || orderId === null) {
    throw new HttpError(400, "Order ID is required");
  }

  const prismaClient = context.prisma || prisma;

  return await prismaClient.$transaction(async (tx: any) => {
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
      throw new HttpError(400, `Order ${orderId} is already fulfilled`);
    }

    // 2. Check stock for all items
    for (const item of order.orderItems) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new HttpError(404, `Product with ID ${item.productId} not found`);
      }

      if (product.stock < item.quantity) {
        throw new HttpError(
          400,
          `Insufficient stock for product ${product.name}. Requested: ${item.quantity}, Available: ${product.stock}`
        );
      }
    }

    // 3 & 4. Decrement stock, create alerts and POs
    for (const item of order.orderItems) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });

      const newStock = product.stock - item.quantity;

      // Update product stock
      await tx.product.update({
        where: { id: product.id },
        data: { stock: newStock },
      });

      // Check if stock falls strictly below lowStockThreshold
      if (newStock < product.lowStockThreshold) {
        // Create Alert
        await tx.alert.create({
          data: {
            productId: product.id,
            message: `Low stock alert for ${product.name} (SKU: ${product.sku}). Current stock: ${newStock}.`,
          },
        });

        // Check for existing PO with status "SENT"
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

    // 5. Set order status to FULFILLED
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: { status: "FULFILLED" },
    });

    return updatedOrder;
  });
};
