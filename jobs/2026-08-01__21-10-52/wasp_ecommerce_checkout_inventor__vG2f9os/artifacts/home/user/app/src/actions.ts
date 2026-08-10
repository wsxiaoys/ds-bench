import { prisma } from "wasp/server";

export const checkout = async (
  args: { items: { productId: number; quantity: number }[]; couponCode?: string | null },
  context: any
) => {
  const { items, couponCode } = args;

  if (!items || items.length === 0) {
    throw new Error("Cart is empty");
  }

  // 1. Sort product IDs to prevent deadlocks
  const productIds = [...new Set(items.map((item) => item.productId))].sort((a, b) => a - b);

  // 2. Start interactive transaction
  const result = await prisma.$transaction(async (tx) => {
    // 3. Lock the product rows to prevent concurrent updates
    const products: any[] = await tx.$queryRawUnsafe(
      `SELECT * FROM "Product" WHERE id IN (${productIds.join(",")}) FOR UPDATE`
    );

    const productMap = new Map(products.map((p) => [p.id, p]));

    // 4. Verify inventory for each item
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }
      if (product.inventory < item.quantity) {
        throw new Error(`Insufficient inventory for product "${product.name}". Available: ${product.inventory}, requested: ${item.quantity}`);
      }
    }

    // 5. Calculate pricing and discount
    let subtotal = 0;
    const orderItemsData: { productId: number; quantity: number; price: number }[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId)!;
      const itemPrice = product.price;
      subtotal += itemPrice * item.quantity;
      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        price: itemPrice,
      });
    }

    let discount = 0;
    if (couponCode) {
      const coupon = await tx.coupon.findUnique({
        where: { code: couponCode.toUpperCase() },
      });
      if (!coupon) {
        throw new Error("Invalid coupon code");
      }

      if (coupon.type === "PERCENT") {
        discount = subtotal * (coupon.value / 100);
      } else if (coupon.type === "FLAT") {
        discount = coupon.value;
      }
    }

    // Ensure discount doesn't exceed subtotal (total cannot go below 0)
    if (discount > subtotal) {
      discount = subtotal;
    }

    const total = Math.max(0, subtotal - discount);

    // 6. Decrement inventory for each product
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          inventory: {
            decrement: item.quantity,
          },
        },
      });
    }

    // 7. Create the Order
    const order = await tx.order.create({
      data: {
        subtotal,
        discount,
        total,
        couponCode: couponCode || null,
        orderItems: {
          create: orderItemsData.map((oi) => ({
            productId: oi.productId,
            quantity: oi.quantity,
            price: oi.price,
          })),
        },
      },
    });

    return order;
  });

  return result;
};
