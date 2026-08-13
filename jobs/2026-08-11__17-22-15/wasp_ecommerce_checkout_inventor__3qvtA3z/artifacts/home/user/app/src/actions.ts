import { prisma } from "wasp/server";
import { HttpError } from "wasp/server";
import type { Checkout } from "wasp/server/operations";

export const checkout: Checkout<{
  items: { productId: string; quantity: number }[];
  couponCode?: string;
}, { orderId: string }> = async (args, context) => {
  const { items, couponCode } = args;

  if (!items || items.length === 0) {
    throw new HttpError(400, "Cart is empty");
  }

  // Perform everything inside an interactive transaction
  const result = await prisma.$transaction(async (tx) => {
    const productsMap: Record<string, any> = {};

    // 1. Lock and validate product inventories
    for (const item of items) {
      if (item.quantity <= 0) {
        throw new HttpError(400, "Quantity must be greater than 0");
      }

      // Use raw query with FOR UPDATE to lock the product row in PostgreSQL
      const products = await tx.$queryRaw<any[]>`
        SELECT * FROM "Product"
        WHERE id = ${item.productId}
        FOR UPDATE
      `;

      if (products.length === 0) {
        throw new HttpError(404, `Product with ID ${item.productId} not found`);
      }

      const product = products[0];

      if (product.inventory < item.quantity) {
        throw new HttpError(400, `Insufficient inventory for product: ${product.name}`);
      }

      // Decrement the inventory
      await tx.product.update({
        where: { id: product.id },
        data: { inventory: product.inventory - item.quantity },
      });

      productsMap[item.productId] = product;
    }

    // 2. Calculate subtotal
    let subtotal = 0;
    for (const item of items) {
      const product = productsMap[item.productId];
      subtotal += product.price * item.quantity;
    }

    // 3. Apply coupon if provided
    let discount = 0;
    let appliedCouponCode: string | null = null;

    if (couponCode) {
      const coupon = await tx.coupon.findUnique({
        where: { code: couponCode.toUpperCase() },
      });

      if (!coupon) {
        throw new HttpError(400, "Invalid coupon code");
      }

      appliedCouponCode = coupon.code;
      if (coupon.type === "PERCENT") {
        discount = subtotal * (coupon.value / 100);
      } else if (coupon.type === "FLAT") {
        discount = coupon.value;
      }
    }

    // Total cannot go below $0.00
    const total = Math.max(0, subtotal - discount);
    const finalDiscount = Math.min(subtotal, discount);

    // 4. Create Order
    const order = await tx.order.create({
      data: {
        couponCode: appliedCouponCode,
        subtotal,
        discount: finalDiscount,
        total,
      },
    });

    // 5. Create OrderItems
    for (const item of items) {
      const product = productsMap[item.productId];
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
        },
      });
    }

    return { orderId: order.id };
  });

  return result;
};
