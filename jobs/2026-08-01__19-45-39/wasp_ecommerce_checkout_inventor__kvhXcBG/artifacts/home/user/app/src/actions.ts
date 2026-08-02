import { type ApplyCoupon, type Checkout } from "wasp/server/operations";
import { HttpError, prisma } from "wasp/server";
import { computeDiscount, roundCents } from "./couponUtils";

export type CartItemInput = {
  productId: string;
  quantity: number;
};

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Merges duplicate cart line items (same productId) into a single entry and
 * drops any non-positive quantities.
 */
function mergeCartItems(items: CartItemInput[]): CartItemInput[] {
  const merged = new Map<string, number>();
  for (const item of items ?? []) {
    if (!item || !item.productId || !Number.isFinite(item.quantity)) {
      continue;
    }
    const quantity = Math.floor(item.quantity);
    if (quantity <= 0) {
      continue;
    }
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + quantity);
  }
  return Array.from(merged.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

// ---------------------------------------------------------------------------
// applyCoupon
// ---------------------------------------------------------------------------

type ApplyCouponInput = {
  code: string;
  items: CartItemInput[];
};

type ApplyCouponOutput = {
  code: string;
  type: string;
  value: number;
  subtotal: number;
  discount: number;
  total: number;
  message: string;
};

export const applyCoupon: ApplyCoupon<
  ApplyCouponInput,
  ApplyCouponOutput
> = async (args, context) => {
  const items = mergeCartItems(args.items);
  if (items.length === 0) {
    throw new HttpError(400, "Your cart is empty. Add items before applying a coupon.");
  }

  const code = normalizeCode(args.code ?? "");
  if (!code) {
    throw new HttpError(400, "Please enter a coupon code.");
  }

  const coupon = await context.entities.Coupon.findUnique({
    where: { code },
  });
  if (!coupon) {
    throw new HttpError(404, "Invalid coupon code.");
  }

  const productIds = items.map((item) => item.productId);
  const products = await context.entities.Product.findMany({
    where: { id: { in: productIds } },
  });

  let subtotal = 0;
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      throw new HttpError(400, "One of the items in your cart no longer exists.");
    }
    subtotal += product.price * item.quantity;
  }
  subtotal = roundCents(subtotal);

  const discount = computeDiscount(coupon, subtotal);
  const total = roundCents(Math.max(0, subtotal - discount));

  return {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    subtotal,
    discount,
    total,
    message: `Coupon "${coupon.code}" applied successfully!`,
  };
};

// ---------------------------------------------------------------------------
// checkout
// ---------------------------------------------------------------------------

type CheckoutInput = {
  items: CartItemInput[];
  couponCode?: string;
};

type CheckoutOutput = {
  orderId: string;
  subtotal: number;
  discount: number;
  total: number;
};

type LockedProductRow = {
  id: string;
  name: string;
  price: number;
  inventory: number;
};

export const checkout: Checkout<CheckoutInput, CheckoutOutput> = async (
  args,
) => {
  const items = mergeCartItems(args.items);
  if (items.length === 0) {
    throw new HttpError(400, "Your cart is empty. Add items before checking out.");
  }

  // Lock product rows in a stable order (sorted by id) to avoid deadlocks
  // between concurrent checkout transactions that touch overlapping sets of
  // products.
  const sortedProductIds = [...items.map((i) => i.productId)].sort();

  const order = await prisma.$transaction(async (tx) => {
    const lockedProducts: LockedProductRow[] = [];
    for (const productId of sortedProductIds) {
      // `SELECT ... FOR UPDATE` takes a row-level lock that is held for the
      // duration of the transaction. Any other concurrent transaction trying
      // to lock the same row will block until this transaction commits or
      // rolls back, which is what makes the inventory check below safe under
      // concurrency.
      const rows = await tx.$queryRaw<LockedProductRow[]>`
        SELECT "id", "name", "price", "inventory"
        FROM "Product"
        WHERE "id" = ${productId}
        FOR UPDATE
      `;
      const row = rows[0];
      if (!row) {
        throw new HttpError(400, "One of the items in your cart no longer exists.");
      }
      lockedProducts.push(row);
    }

    let subtotal = 0;
    for (const item of items) {
      const product = lockedProducts.find((p) => p.id === item.productId)!;
      if (product.inventory < item.quantity) {
        throw new HttpError(
          400,
          `Insufficient inventory for "${product.name}". Out of stock: only ${product.inventory} left.`,
        );
      }
      subtotal += product.price * item.quantity;
    }
    subtotal = roundCents(subtotal);

    let discount = 0;
    let normalizedCouponCode: string | undefined;
    if (args.couponCode && args.couponCode.trim().length > 0) {
      const code = normalizeCode(args.couponCode);
      const coupon = await tx.coupon.findUnique({ where: { code } });
      if (!coupon) {
        throw new HttpError(404, "Invalid coupon code.");
      }
      discount = computeDiscount(coupon, subtotal);
      normalizedCouponCode = coupon.code;
    }

    const total = roundCents(Math.max(0, subtotal - discount));

    // Decrement inventory for every product in the cart. Because we hold a
    // row lock (from the `FOR UPDATE` select above) for each product involved,
    // this decrement is safe from lost updates / race conditions.
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { inventory: { decrement: item.quantity } },
      });
    }

    const createdOrder = await tx.order.create({
      data: {
        subtotal,
        discount,
        total,
        couponCode: normalizedCouponCode,
        items: {
          create: items.map((item) => {
            const product = lockedProducts.find(
              (p) => p.id === item.productId,
            )!;
            return {
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: product.price,
            };
          }),
        },
      },
    });

    return createdOrder;
  });

  return {
    orderId: order.id,
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
  };
};
