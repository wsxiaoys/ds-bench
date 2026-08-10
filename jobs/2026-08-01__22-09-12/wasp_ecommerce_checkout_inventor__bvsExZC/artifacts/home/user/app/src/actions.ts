import { type AddToCart, type ApplyCoupon, type Checkout } from "wasp/server/operations";
import { HttpError } from "wasp/server";
import { prisma } from "wasp/server";

// We use an in-memory cart for simplicity.
// Cart items: { productId: number, quantity: number }

type CartItem = {
  productId: number;
  quantity: number;
};

// In-memory cart (resets on server restart)
let cart: CartItem[] = [];

type AddToCartInput = { productId: number; quantity: number };
type AddToCartOutput = { success: boolean; cart: CartItem[] };

export const addToCart: AddToCart<AddToCartInput, AddToCartOutput> = async (args, context) => {
  const { productId, quantity } = args;

  const product = await context.entities.Product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new HttpError(404, "Product not found");
  }

  const existingIndex = cart.findIndex((item) => item.productId === productId);
  if (existingIndex >= 0) {
    cart[existingIndex].quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }

  return { success: true, cart };
};

type ApplyCouponInput = { code: string };
type ApplyCouponOutput = {
  success: boolean;
  discount: number;
  discountType: string;
  discountValue: number;
  subtotal: number;
  total: number;
  cartItems: { productId: number; name: string; price: number; quantity: number }[];
};

export const applyCoupon: ApplyCoupon<ApplyCouponInput, ApplyCouponOutput> = async (args, context) => {
  const { code } = args;

  const coupon = await context.entities.Coupon.findUnique({
    where: { code },
  });

  if (!coupon) {
    throw new HttpError(400, "Invalid coupon code");
  }

  // Calculate subtotal from cart
  let subtotal = 0;
  const cartItems: ApplyCouponOutput["cartItems"] = [];

  for (const item of cart) {
    const product = await context.entities.Product.findUnique({
      where: { id: item.productId },
      select: { id: true, name: true, price: true },
    });
    if (product) {
      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;
      cartItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
      });
    }
  }

  // Calculate discount
  let discount = 0;
  if (coupon.discountType === "PERCENTAGE") {
    discount = subtotal * (coupon.discountValue / 100);
  } else if (coupon.discountType === "FLAT") {
    discount = Math.min(coupon.discountValue, subtotal);
  }

  const total = Math.max(subtotal - discount, 0);

  return {
    success: true,
    discount,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    subtotal,
    total,
    cartItems,
  };
};

type CheckoutInput = { couponCode?: string };
type CheckoutOutput = {
  success: boolean;
  orderId: number;
  subtotal: number;
  discount: number;
  total: number;
};

export const checkout: Checkout<CheckoutInput, CheckoutOutput> = async (args, _context) => {
  const { couponCode } = args;

  if (cart.length === 0) {
    throw new HttpError(400, "Cart is empty");
  }

  // Use a Prisma interactive transaction for concurrent safety
  const result = await prisma.$transaction(async (tx) => {
    // Lock the products in the cart using row-level locking.
    // We use raw SQL for SELECT ... FOR UPDATE to ensure proper locking.
    const productIds = cart.map((item) => item.productId);

    // Fetch products within the transaction - Prisma uses row-level locks
    // when using findUnique/findMany inside a transaction for writes.
    // But to be extra safe with concurrency, we'll use raw SQL with FOR UPDATE.
    const lockedProducts = await tx.$queryRawUnsafe<Array<{ id: number; name: string; price: number; inventory: number }>>(
      `SELECT id, name, price, inventory FROM "Product" WHERE id = ANY($1::int[]) FOR UPDATE`,
      productIds
    );

    // Create a map for quick lookup
    const productMap = new Map(lockedProducts.map((p) => [p.id, p]));

    // Verify all products exist and have sufficient inventory
    for (const item of cart) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new HttpError(404, `Product with id ${item.productId} not found`);
      }
      if (product.inventory < item.quantity) {
        throw new HttpError(
          400,
          `Insufficient inventory for "${product.name}". Only ${product.inventory} left in stock.`
        );
      }
    }

    // Calculate subtotal
    let subtotal = 0;
    for (const item of cart) {
      const product = productMap.get(item.productId)!;
      subtotal += product.price * item.quantity;
    }

    // Calculate discount if coupon provided
    let discount = 0;
    let couponId: number | null = null;

    if (couponCode) {
      const coupons = await tx.$queryRawUnsafe<Array<{ id: number; code: string; discountType: string; discountValue: number }>>(
        `SELECT id, code, "discountType", "discountValue" FROM "Coupon" WHERE code = $1`,
        couponCode
      );

      const coupon = coupons[0];
      if (!coupon) {
        throw new HttpError(400, "Invalid coupon code");
      }

      couponId = coupon.id;

      if (coupon.discountType === "PERCENTAGE") {
        discount = subtotal * (coupon.discountValue / 100);
      } else if (coupon.discountType === "FLAT") {
        discount = Math.min(coupon.discountValue, subtotal);
      }
    }

    const total = Math.max(subtotal - discount, 0);

    // Decrement inventory for each product
    for (const item of cart) {
      await tx.$executeRawUnsafe(
        `UPDATE "Product" SET inventory = inventory - $1 WHERE id = $2`,
        item.quantity,
        item.productId
      );
    }

    // Create the order
    const orderResult = await tx.$queryRawUnsafe<Array<{ id: number }>>(
      `INSERT INTO "Order" (subtotal, discount, total, "couponId", "createdAt") VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      subtotal,
      discount,
      total,
      couponId,
      new Date()
    );

    const orderId = orderResult[0].id;

    // Create order items
    for (const item of cart) {
      const product = productMap.get(item.productId)!;
      await tx.$executeRawUnsafe(
        `INSERT INTO "OrderItem" (quantity, price, "productId", "orderId") VALUES ($1, $2, $3, $4)`,
        item.quantity,
        product.price,
        item.productId,
        orderId
      );
    }

    return {
      success: true as const,
      orderId,
      subtotal,
      discount,
      total,
    };
  });

  // Clear the cart after successful checkout
  cart = [];

  return result;
};
