import { prisma } from "wasp/server";

export const fulfillOrder = async ({ orderId }: { orderId: number }, context: any) => {
  return prisma.$transaction(async (tx: any) => {
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
      throw new Error("Order not found");
    }

    if (order.status === "FULFILLED") {
      throw new Error("Order is already fulfilled");
    }

    // 2. Check stock levels for all items
    for (const item of order.orderItems) {
      if (item.product.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for ${item.product.name} (SKU: ${item.product.sku}). ` +
          `Required: ${item.quantity}, Available: ${item.product.stock}`
        );
      }
    }

    // 3. Decrement stock for each product
    for (const item of order.orderItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });
    }

    // 4. Check low stock thresholds and create alerts / purchase orders
    for (const item of order.orderItems) {
      const updatedProduct = await tx.product.findUnique({
        where: { id: item.productId },
      });

      if (!updatedProduct) continue;

      if (updatedProduct.stock < updatedProduct.lowStockThreshold) {
        // Create low-stock alert
        await tx.alert.create({
          data: {
            productId: updatedProduct.id,
            message: `Low stock alert for ${updatedProduct.name} (SKU: ${updatedProduct.sku}). Current stock: ${updatedProduct.stock}.`,
          },
        });

        // Check if there is already an existing PurchaseOrder for this product with status "SENT"
        const existingPO = await tx.purchaseOrder.findFirst({
          where: {
            productId: updatedProduct.id,
            status: "SENT",
          },
        });

        if (!existingPO) {
          await tx.purchaseOrder.create({
            data: {
              supplierId: updatedProduct.supplierId,
              productId: updatedProduct.id,
              quantity: updatedProduct.reorderQuantity,
              status: "SENT",
            },
          });
        }
      }
    }

    // 5. Set order status to FULFILLED
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "FULFILLED",
      },
    });

    return { success: true };
  });
};
