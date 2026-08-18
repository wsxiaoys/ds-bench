import { HttpError } from 'wasp/server';

export async function getProducts(args: any, context: any) {
  return context.entities.Product.findMany({
    orderBy: { id: 'asc' },
  });
}

export async function getCoupon(args: { code: string }, context: any) {
  if (!args.code) {
    throw new HttpError(400, "Coupon code is required");
  }
  const coupon = await context.entities.Coupon.findUnique({
    where: { code: args.code.trim().toUpperCase() },
  });
  if (!coupon) {
    throw new HttpError(404, "Invalid coupon code");
  }
  return coupon;
}
