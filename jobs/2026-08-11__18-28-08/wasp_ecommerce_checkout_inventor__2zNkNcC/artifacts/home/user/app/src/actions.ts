import { HttpError } from 'wasp/server';
import { prisma } from 'wasp/server';

interface CartItem {
  productId: number;
  quantity: number;
}

interface CheckoutArgs {
  items: CartItem[];
  couponCode?: string;
}

export async function checkout(args: CheckoutArgs, context: any) {
  const { items, couponCode } = args;

  if (!items || items.length === 0) {
    throw new HttpError(400, "Cart is empty");
  }

  for (const item of items) {
    if (item.quantity <= 0) {
      throw new HttpError(400, "Quantity must be greater than zero");
    }
  }

  // Run the entire checkout inside an interactive transaction
  return await prisma.$transaction(async (tx) => {
    // Sort items by productId ascending to prevent deadlocks across concurrent requests
    const sortedItems = [...items].sort((a, b) => a.productId - b.productId);

    const lockedProductsMap: Record<number, any> = {};
    let subtotal = 0;

    for (const item of sortedItems) {
      // Lock the product row using SELECT FOR UPDATE
      const lockedProducts = await tx.$queryRaw<any[]>`
        SELECT * FROM "Product" WHERE id = ${item.productId} FOR UPDATE
      `;

      if (lockedProducts.length === 0) {
        throw new HttpError(404, `Product with ID ${item.productId} not found`);
      }

      const product = lockedProducts[0];

      if (product.inventory < item.quantity) {
        throw new HttpError(400, `Insufficient inventory for ${product.name}. Out of stock.`);
      }

      // Decrement inventory
      await tx.product.update({
        where: { id: item.productId },
        data: {
          inventory: product.inventory - item.quantity,
        },
      });

      lockedProductsMap[item.productId] = product;
      subtotal += product.price * item.quantity;
    }

    // Validate coupon code if provided
    let coupon: any = null;
    if (couponCode && couponCode.trim()) {
      coupon = await tx.coupon.findUnique({
        where: { code: couponCode.trim().toUpperCase() },
      });
      if (!coupon) {
        throw new HttpError(400, "Invalid coupon code");
      }
    }

    // Calculate discount and total
    let discount = 0;
    if (coupon) {
      if (coupon.type === "percentage") {
        discount = subtotal * (coupon.value / 100);
      } else if (coupon.type === "flat") {
        discount = coupon.value;
      }
    }

    // Cap discount at subtotal to prevent total going below 0.00
    discount = Math.min(subtotal, discount);
    const total = subtotal - discount;

    // Create Order and OrderItems
    const order = await tx.order.create({
      data: {
        subtotal,
        discount,
        total,
        couponCode: couponCode ? couponCode.trim().toUpperCase() : null,
        items: {
          create: items.map((item) => {
            const product = lockedProductsMap[item.productId];
            return {
              productId: item.productId,
              quantity: item.quantity,
              price: product.price,
            };
          }),
        },
      },
    });

    return {
      orderId: order.id,
      subtotal,
      discount,
      total,
    };
  });
}
