export const applyCoupon = async (args: { code: string }, context: any) => {
  const Coupon = context.entities.Coupon;
  const coupon = await Coupon.findUnique({
    where: { code: args.code.toUpperCase() }
  });
  if (!coupon) {
    throw new Error("Invalid coupon code");
  }
  return coupon;
};

export const checkout = async (
  args: {
    items: { productId: number; quantity: number }[];
    couponCode?: string;
  },
  context: any
) => {
  const prisma = context.prisma;
  if (!prisma) {
    throw new Error("Prisma client not found in context");
  }

  if (!args.items || args.items.length === 0) {
    throw new Error("Your cart is empty");
  }

  const isPostgres = process.env.DATABASE_URL?.startsWith("postgres") || process.env.DATABASE_URL?.startsWith("postgresql");

  return await prisma.$transaction(async (tx: any) => {
    let subtotal = 0;
    const productMap: Record<number, any> = {};

    for (const item of args.items) {
      if (item.quantity <= 0) {
        throw new Error("Quantity must be greater than 0");
      }

      let product: any = null;
      if (isPostgres) {
        const products = await tx.$queryRawUnsafe(
          `SELECT * FROM "Product" WHERE id = $1 FOR UPDATE`,
          item.productId
        );
        if (Array.isArray(products) && products.length > 0) {
          product = products[0];
        }
      } else {
        product = await tx.product.findUnique({
          where: { id: item.productId }
        });
      }

      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }

      if (product.inventory < item.quantity) {
        throw new Error(`Insufficient inventory. Out of stock.`);
      }

      await tx.product.update({
        where: { id: product.id },
        data: {
          inventory: product.inventory - item.quantity
        }
      });

      subtotal += product.price * item.quantity;
      productMap[product.id] = product;
    }

    let discount = 0;
    let coupon: any = null;
    if (args.couponCode) {
      coupon = await tx.coupon.findUnique({
        where: { code: args.couponCode.toUpperCase() }
      });
      if (!coupon) {
        throw new Error("Invalid coupon code");
      }

      if (coupon.type === "PERCENTAGE") {
        discount = subtotal * (coupon.value / 100.0);
      } else if (coupon.type === "FLAT") {
        discount = coupon.value;
      }
    }

    let total = subtotal - discount;
    if (total < 0) {
      total = 0;
    }

    const order = await tx.order.create({
      data: {
        couponCode: args.couponCode || null,
        subtotal,
        discount,
        total,
        orderItems: {
          create: args.items.map((item: any) => {
            const prod = productMap[item.productId];
            return {
              productId: item.productId,
              quantity: item.quantity,
              price: prod.price
            };
          })
        }
      }
    });

    return {
      orderId: order.id,
      subtotal,
      discount,
      total
    };
  });
};
