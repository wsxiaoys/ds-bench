import { HttpError } from "wasp/server";
import { prisma } from "wasp/server";

export const checkout = async (
  args: {
    items: { productId: number; quantity: number }[];
    couponCode?: string;
  },
  context: any
) => {
  const { items, couponCode } = args;

  if (!items || items.length === 0) {
    throw new HttpError(400, "Cart is empty");
  }

  // Use a transaction
  return await prisma.$transaction(async (tx) => {
    let subtotal = 0;
    const orderItemsToCreate: { productId: number; quantity: number; price: number }[] = [];

    // Process each item
    for (const item of items) {
      if (item.quantity <= 0) {
        throw new HttpError(400, "Invalid quantity");
      }

      // Lock the product row for update
      const products = await tx.$queryRaw<any[]>`
        SELECT * FROM "Product" WHERE id = ${item.productId} FOR UPDATE
      `;

      if (products.length === 0) {
        throw new HttpError(404, `Product with ID ${item.productId} not found`);
      }

      const product = products[0];

      if (product.inventory < item.quantity) {
        throw new HttpError(400, `Insufficient inventory. Out of stock for product: ${product.name}`);
      }

      // Decrement inventory
      await tx.product.update({
        where: { id: item.productId },
        data: {
          inventory: product.inventory - item.quantity,
        },
      });

      const itemPrice = product.price;
      const itemSubtotal = itemPrice * item.quantity;
      subtotal += itemSubtotal;

      orderItemsToCreate.push({
        productId: item.productId,
        quantity: item.quantity,
        price: itemPrice,
      });
    }

    // Apply coupon if provided
    let discount = 0;
    if (couponCode) {
      const coupon = await tx.coupon.findUnique({
        where: { code: couponCode.toUpperCase() },
      });

      if (!coupon) {
        throw new HttpError(400, "Invalid coupon code");
      }

      if (coupon.type === "PERCENT") {
        discount = subtotal * (coupon.value / 100.0);
      } else if (coupon.type === "FLAT") {
        discount = coupon.value;
      }
    }

    // Ensure discount is not negative and grand total cannot go below $0.00
    const total = Math.max(0, subtotal - discount);
    // Recalculate discount if total is capped at 0
    const actualDiscount = subtotal - total;

    // Create the order
    const order = await tx.order.create({
      data: {
        subtotal,
        discount: actualDiscount,
        total,
        couponCode: couponCode ? couponCode.toUpperCase() : null,
        items: {
          create: orderItemsToCreate,
        },
      },
      include: {
        items: true,
      },
    });

    return order;
  });
};
