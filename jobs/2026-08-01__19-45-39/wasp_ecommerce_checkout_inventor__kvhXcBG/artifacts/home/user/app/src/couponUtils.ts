export type CouponLike = {
  type: string;
  value: number;
};

/**
 * Computes the discount amount for a given coupon and cart subtotal.
 *
 * - "PERCENTAGE" coupons discount a percentage of the subtotal.
 * - "FLAT" coupons discount a flat amount, capped at the subtotal so the
 *   resulting total never goes below $0.00.
 */
export function computeDiscount(coupon: CouponLike, subtotal: number): number {
  if (coupon.type === "PERCENTAGE") {
    return roundCents((subtotal * coupon.value) / 100);
  }
  if (coupon.type === "FLAT") {
    return roundCents(Math.min(coupon.value, subtotal));
  }
  return 0;
}

export function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}
