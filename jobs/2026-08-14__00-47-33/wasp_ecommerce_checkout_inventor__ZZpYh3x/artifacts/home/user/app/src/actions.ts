import { HttpError } from "wasp/server";

export const applyCoupon = async (args: { code: string }, context: any) => {
  if (!args.code) {
    throw new HttpError(400, "Coupon code is required");
  }
  const coupon = await context.entities.Coupon.findUnique({
    where: { code: args.code.toUpperCase() },
  });
  if (!coupon) {
    throw new HttpError(404, "Invalid coupon code");
  }
  return coupon;
};

export const checkout = async (
  args: { items: { productId: number; quantity: number }[]; couponCode?: string },
  context: any
) => {
  const { items, couponCode } = args;

  if (!items || items.length === 0) {
    throw new HttpError(400, "Cart is empty");
  }

  // Use interactive transaction to guarantee atomicity and locking
  const order = await context.prisma.$transaction(async (tx: any) => {
    let subtotal = 0;
    const orderItemsToCreate = [];

    // Loop through each item and lock/update product inventory
    for (const item of items) {
      if (item.quantity <= 0) {
        throw new HttpError(400, `Invalid quantity for product ID: ${item.productId}`);
      }

      // Lock the product row using SELECT ... FOR UPDATE
      const products = await tx.$queryRaw`
        SELECT id, name, price, inventory FROM "Product"
        WHERE id = ${item.productId}
        FOR UPDATE
      `;

      if (!products || products.length === 0) {
        throw new HttpError(404, `Product not found: ID ${item.productId}`);
      }

      const product = products[0];

      if (product.inventory < item.quantity) {
        throw new HttpError(400, "Insufficient inventory");
      }

      // Decrement the inventory
      await tx.product.update({
        where: { id: item.productId },
        data: {
          inventory: {
            decrement: item.quantity,
          },
        },
      });

      const itemPrice = product.price;
      subtotal += itemPrice * item.quantity;

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

      if (coupon.type === "PERCENTAGE") {
        discount = subtotal * (coupon.value / 100);
      } else if (coupon.type === "FLAT") {
        discount = coupon.value;
      }

      if (discount > subtotal) {
        discount = subtotal;
      }
    }

    const total = subtotal - discount;

    // Create the order
    const newOrder = await tx.order.create({
      data: {
        subtotal,
        discount,
        total,
        couponCode: couponCode ? couponCode.toUpperCase() : null,
        items: {
          create: orderItemsToCreate.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
    });

    return newOrder;
  });

  return order;
};
