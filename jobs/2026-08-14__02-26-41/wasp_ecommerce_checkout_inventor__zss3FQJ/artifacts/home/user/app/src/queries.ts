import { HttpError } from "wasp/server";

export const getProducts = async (_args: any, context: any) => {
  return context.entities.Product.findMany({
    orderBy: { id: "asc" },
  });
};

export const validateCoupon = async (args: { code: string }, context: any) => {
  const coupon = await context.entities.Coupon.findUnique({
    where: { code: args.code.toUpperCase() },
  });
  if (!coupon) {
    throw new HttpError(404, "Invalid coupon code");
  }
  return coupon;
};
